import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";

const api = "http://127.0.0.1:54321";
const container = "supabase_db_HueNoi-git";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, api, "This test runs only on Supabase local");
assert.match(key ?? "", /^sb_publishable_/, "Use the local publishable key");
assert.equal(execFileSync("docker", ["inspect", "--format", "{{.State.Running}}", container], {
  encoding: "utf8",
}).trim(), "true");

const client = () => createClient(api, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const id = randomUUID();
const marker = `FIXTURE ONLY ${id}`;
const email = (letter) => `fixture-${id}-${letter}@example.com`;
const editor = `fixture_${id.replaceAll("-", "")}`;
const password = randomUUID();
const source = { live: randomUUID(), draft: randomUUID(), withdrawn: randomUUID() };
const entry = { live: randomUUID(), draft: randomUUID(), hidden: randomUUID(), withdrawn: randomUUID() };

function sql(statement, asEditor = false, expectedError) {
  const connection = asEditor
    ? ["-e", `PGPASSWORD=${password}`, container, "psql", "-h", "127.0.0.1", "-U", editor]
    : [container, "psql", "-U", "postgres"];
  const result = spawnSync("docker", [
    "exec", "-i", ...connection, "-X", "-qAt", "-d", "postgres",
    "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose",
  ], { input: statement, encoding: "utf8", timeout: 15_000 });
  if (expectedError) {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, new RegExp(`ERROR:\\s+${expectedError}:`));
  } else {
    assert.equal(result.status, 0, result.stderr || result.error?.message);
  }
  return result.stdout.trim();
}

function ids(records) {
  return records.map((row) => row.id).sort();
}

function denied(result, operation) {
  assert.equal(result.error?.code, "42501", operation);
  assert.ok(result.status === 401 || result.status === 403, operation);
}

function fixtureSnapshot() {
  return JSON.parse(sql(`
    select jsonb_build_object(
      'sources', (select jsonb_agg(s order by s.id) from public.content_sources s where s.title = '${marker}'),
      'entries', (select jsonb_agg(e order by e.id) from public.learning_entries e where e.text = '${marker}')
    );
  `, true));
}

test("M1-04 catalog RLS on Supabase local", { timeout: 90_000 }, async (t) => {
  // Admin access is confined to fixture setup, inventory and cleanup.
  t.after(() => {
    sql(`
      delete from public.learning_entries where text = '${marker}' or id in (${Object.values(entry).map((value) => `'${value}'`).join(",")});
      delete from public.content_sources where title = '${marker}' or id in (${Object.values(source).map((value) => `'${value}'`).join(",")});
      delete from auth.users where email in ('${email("a")}', '${email("b")}');
      drop role if exists ${editor};
    `);
  });

  const anon = client();
  const userA = client();
  const userB = client();
  async function signUp(user, letter, metadata) {
    const { data, error } = await user.auth.signUp({
      email: email(letter), password, options: { data: metadata },
    });
    assert.ifError(error);
    assert.ok(data.session, "Local email confirmation must be disabled for fixture signup");
    const claims = JSON.parse(Buffer.from(data.session.access_token.split(".")[1], "base64url"));
    assert.equal(claims.role, "authenticated");
    assert.equal(claims.sub, data.user.id);
    return { claims, userId: data.user.id };
  }
  const a = await signUp(userA, "a", { role: "hue_catalog_editor", is_editor: true });
  const b = await signUp(userB, "b");
  assert.notEqual(a.userId, b.userId);
  assert.equal(a.claims.user_metadata.role, "hue_catalog_editor");

  sql(`
    create role ${editor} login inherit nosuperuser nocreatedb nocreaterole noreplication
      nobypassrls password '${password}';
    grant hue_catalog_editor to ${editor};
  `);

  await t.test("editor uses an independent DB login and can SELECT, INSERT and UPDATE only", () => {
    assert.equal(sql(`
      select current_user, session_user, rolsuper, rolbypassrls
      from pg_roles where rolname = current_user;
    `, true), `${editor}|${editor}|f|f`);
    sql(`
      insert into public.content_sources (id, title, locator, rights_note, status, reviewed_by, reviewed_at)
      values
        ('${source.live}', '${marker}', 'live', 'SYNTHETIC FIXTURE', 'published', '${a.userId}', now()),
        ('${source.draft}', '${marker}', 'draft', null, 'draft', null, null),
        ('${source.withdrawn}', '${marker}', 'withdrawn', 'SYNTHETIC FIXTURE', 'published', '${a.userId}', now());
      insert into public.learning_entries (id, source_id, kind, text, meaning, source_locator, status)
      values
        ('${entry.live}', '${source.live}', 'vocabulary', '${marker}', 'fixture', '1', 'published'),
        ('${entry.draft}', '${source.live}', 'sentence', '${marker}', 'fixture', '2', 'draft'),
        ('${entry.hidden}', '${source.draft}', 'vocabulary', '${marker}', 'fixture', '1', 'published'),
        ('${entry.withdrawn}', '${source.withdrawn}', 'vocabulary', '${marker}', 'fixture', '1', 'published');
      update public.learning_entries set meaning = 'SYNTHETIC FIXTURE' where id = '${entry.draft}';
    `, true);
    assert.equal(sql(`select meaning from public.learning_entries where id = '${entry.draft}';`, true),
      "SYNTHETIC FIXTURE");
    assert.equal(sql(`select count(*) from public.content_sources where title = '${marker}';`, true), "3");
    for (const [table, target] of [["content_sources", source.draft], ["learning_entries", entry.draft]]) {
      sql(`delete from public.${table} where id = '${target}';`, true, "42501");
    }
    sql(`update public.content_sources set status = 'published' where id = '${source.draft}';`, true, "23514");
    sql(`insert into public.content_sources (title, locator) values ('${marker}', 'live');`, true, "23505");
    sql(`update public.learning_entries set source_id = '${randomUUID()}' where id = '${entry.draft}';`, true, "23503");
  });

  const catalog = (user) => user.from("learning_entries").select("id,status")
    .in("id", Object.values(entry));
  const before = await catalog(anon);
  assert.ifError(before.error);
  assert.deepEqual(ids(before.data), [entry.live, entry.withdrawn].sort());

  sql(`update public.content_sources set status = 'withdrawn' where id = '${source.withdrawn}';`, true);
  assert.equal(sql(`select status from public.learning_entries where id = '${entry.withdrawn}';`, true), "published");

  // The independent editor connection sees rows even if a forbidden UPDATE hides them from API roles.
  const baseline = fixtureSnapshot();
  assert.equal(baseline.sources.length, Object.keys(source).length);
  assert.equal(baseline.entries.length, Object.keys(entry).length);

  for (const [label, user] of [["anon", anon], ["user A with forged metadata", userA], ["user B", userB]]) {
    await t.test(`${label}: published only, no writes and no hidden columns`, async () => {
      const visible = await catalog(user);
      assert.ifError(visible.error);
      assert.deepEqual(ids(visible.data), [entry.live]);
      const sources = await user.from("content_sources").select("id,title,locator,status")
        .in("id", Object.values(source));
      assert.ifError(sources.error);
      assert.deepEqual(ids(sources.data), [source.live]);
      denied(await user.from("content_sources").select("id,rights_note,reviewed_by,reviewed_at").eq("id", source.live));
      const detail = await user.from("learning_entries").select("id").eq("id", entry.withdrawn).maybeSingle();
      assert.ifError(detail.error);
      assert.equal(detail.data, null);

      const mutations = [
        ["source INSERT", () => user.from("content_sources").insert({ title: marker, locator: "forbidden" })],
        ["source UPDATE without select", () =>
          user.from("content_sources").update({ status: "draft" }).eq("id", source.live)],
        ["source UPDATE with select", () =>
          user.from("content_sources").update({ status: "draft" }).eq("id", source.live).select("id")],
        ["source DELETE", () => user.from("content_sources").delete().eq("id", source.live)],
        ["entry INSERT", () => user.from("learning_entries").insert({
          source_id: source.live, kind: "sentence", text: marker, meaning: "fixture", source_locator: "forbidden",
        })],
        ["entry UPDATE without select", () =>
          user.from("learning_entries").update({ status: "draft" }).eq("id", entry.live)],
        ["entry UPDATE with select", () =>
          user.from("learning_entries").update({ status: "draft" }).eq("id", entry.live).select("id")],
        ["entry DELETE", () => user.from("learning_entries").delete().eq("id", entry.live)],
      ];
      for (const [operation, mutate] of mutations) {
        const result = await mutate();
        assert.deepEqual(fixtureSnapshot(), baseline, `${label}: ${operation} changed persisted data`);
        denied(result, `${label}: ${operation}`);
      }
    });

    await t.test(`${label}: PostgREST embed honors RLS and local GraphQL is disabled`, async () => {
      const embedded = await user.from("content_sources")
        .select("id,learning_entries(id)").in("id", Object.values(source));
      assert.ifError(embedded.error);
      assert.deepEqual(embedded.data, [{ id: source.live, learning_entries: [{ id: entry.live }] }]);

      const { data: { session } } = await user.auth.getSession();
      const response = await fetch(api + "/graphql/v1", {
        method: "POST",
        headers: {
          apikey: key,
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          query: `{ learning_entriesCollection(filter: { id: { in: [${Object.values(entry).map(JSON.stringify).join(",")}] } }) { edges { node { id } } } }`,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.deepEqual(body.errors?.map(({ message }) => message), ["pg_graphql extension is not enabled."]);
      assert.equal(body.data ?? null, null);
    });
  }

  await t.test("no exposed view or catalog RPC", () => {
    assert.equal(sql(`
      select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ('public', 'graphql_public') and c.relkind in ('v', 'm', 'f');
    `), "0");
    assert.equal(sql(`
      select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'graphql_public')
        and not (n.nspname = 'graphql_public' and p.proname = 'graphql');
    `), "0");
  });

  await t.test("API roles cannot inherit, SET ROLE to, or exercise catalog editor grants", () => {
    for (const role of ["anon", "authenticated", "authenticator"]) {
      assert.equal(sql(`
        select pg_has_role('${role}', 'hue_catalog_editor', 'MEMBER'),
               pg_has_role('${role}', 'hue_catalog_editor', 'USAGE'),
               pg_has_role('${role}', 'hue_catalog_editor', 'SET');
      `), "f|f|f", role);

      for (const table of ["public.content_sources", "public.learning_entries"]) {
        assert.equal(sql(`
          select has_any_column_privilege('${role}', '${table}', 'INSERT'),
                 has_any_column_privilege('${role}', '${table}', 'UPDATE'),
                 has_table_privilege('${role}', '${table}', 'DELETE'),
                 has_table_privilege('${role}', '${table}', 'TRUNCATE');
        `), "f|f|f|f", `${role}: ${table}`);
      }
      assert.equal(sql(`
        select has_column_privilege('${role}', 'public.content_sources', 'rights_note', 'SELECT'),
               has_column_privilege('${role}', 'public.content_sources', 'reviewed_by', 'SELECT'),
               has_column_privilege('${role}', 'public.content_sources', 'reviewed_at', 'SELECT');
      `), "f|f|f", role);
    }
  });
});
