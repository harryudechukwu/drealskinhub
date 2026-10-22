import { DatabaseSync } from 'node:sqlite';
import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import * as seed from './seed.mjs';

export async function openDatabase(filename,{url=process.env.TURSO_DATABASE_URL,authToken=process.env.TURSO_AUTH_TOKEN,client:providedClient}={}) {
  const context=new AsyncLocalStorage();let client,native;
  if(url||providedClient){
    if(providedClient)client=providedClient;
    else {const {createClient}=await import('@libsql/client/web');client=createClient({url:url.replace(/^libsql:/,'https:'),authToken,intMode:'number'});}
  }else{if(filename!==':memory:')mkdirSync(dirname(filename),{recursive:true});native=new DatabaseSync(filename);native.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');}
  const execute=async(sql,args=[])=>{
    if(client)return (context.getStore()?.tx||client).execute({sql,args});
    const statement=native.prepare(sql);if(/^\s*(select|pragma|with)/i.test(sql))return {rows:statement.all(...args)};
    return {rows:[],...statement.run(...args)};
  };
  const db={prepare:sql=>({get:async(...args)=>(await execute(sql,args)).rows[0],all:async(...args)=>(await execute(sql,args)).rows,run:(...args)=>execute(sql,args)}),
    exec:async sql=>client?(context.getStore()?.tx||client).executeMultiple(sql):native.exec(sql),close:()=>client?client.close():native.close()};
  await db.exec(`CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(kind,id));
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer', created TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS single_initial_admin ON users(role) WHERE role='admin';
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS resets (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS idempotency (key TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, response TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);`);
  const loadKind=async kind=>{
    const ctx=context.getStore();if(ctx?.cache.has(kind))return ctx.cache.get(kind);
    const items=new Map((await db.prepare('SELECT body FROM records WHERE kind=? ORDER BY rowid DESC').all(kind)).map(r=>{const item=JSON.parse(r.body);return [item.id,item];}));
    ctx?.cache.set(kind,items);return items;
  };
  const get=async(kind,id)=>{
    if(context.getStore())return structuredClone((await loadKind(kind)).get(id)||null);
    const row=await db.prepare('SELECT body FROM records WHERE kind=? AND id=?').get(kind,id);return row?JSON.parse(row.body):null;
  };
  const all=async kind=>[...(await loadKind(kind)).values()].map(x=>structuredClone(x));
  const upsertSQL='INSERT INTO records(kind,id,body) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET body=excluded.body';
  const put=async(kind,data)=>{
    const record={...data,id:data.id||randomUUID()},ctx=context.getStore();
    if(ctx){(await loadKind(kind)).set(record.id,structuredClone(record));ctx.pending.set(kind+':'+record.id,{sql:upsertSQL,args:[kind,record.id,JSON.stringify(record)]});}
    else await db.prepare(upsertSQL).run(kind,record.id,JSON.stringify(record));return record;
  };
  const remove=async(kind,id)=>{
    const ctx=context.getStore();if(ctx){(await loadKind(kind)).delete(id);ctx.pending.set(kind+':'+id,{sql:'DELETE FROM records WHERE kind=? AND id=?',args:[kind,id]});}
    else await db.prepare('DELETE FROM records WHERE kind=? AND id=?').run(kind,id);
  };
  const transaction=async fn=>{
    if(context.getStore())return fn();
    const tx=client?await client.transaction('write'):null;
    if(!client)native.exec('BEGIN IMMEDIATE');
    try{
      const ctx={tx,cache:new Map(),pending:new Map()};
      const result=await context.run(ctx,fn),statements=[...ctx.pending.values()];
      if(client){if(statements.length)await tx.batch(statements);await tx.commit();}
      else {for(const s of statements)native.prepare(s.sql).run(...s.args);native.exec('COMMIT');}
      return result;
    }catch(error){try{if(tx)await tx.rollback();else native.exec('ROLLBACK');}catch{}throw error;}finally{tx?.close();}
  };
  let queue=Promise.resolve();
  const withRequest=fn=>{if(client)return fn();const result=queue.then(fn,fn);queue=result.catch(()=>{});return result;};
  if(!await get('settings','main'))await transaction(async()=>{
    if(await get('settings','main'))return;
    await put('settings',{...seed.settings,id:'main'});
    for(const kind of ['products','pages','faqs','articles'])for(const item of [...seed[kind]].reverse())await put(kind,item);
  });
  return {db,get,all,put,remove,transaction,withRequest,remote:!!client};
}
