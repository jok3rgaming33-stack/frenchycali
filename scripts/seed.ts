import pg from "pg"
const url = process.env.DATABASE_URL
if (!url) { console.error("DATABASE_URL missing"); process.exit(1) }
const pool = new pg.Pool({ connectionString: url })
const cats = [
  ["fleurs","Fleurs CBD",0],
  ["huiles","Huiles CBD",1],
  ["resines","Résines CBD",2],
  ["vapes","Vapes CBD",3],
]
async function main() {
  const c = await pool.connect()
  try {
    await c.query("BEGIN")
    for (const [key,name,ord] of cats) {
      await c.query(`INSERT INTO categories (key,name,sort_order) VALUES ($1,$2,$3) ON CONFLICT (key) DO UPDATE SET name=EXCLUDED.name`, [key,name,ord])
    }
    const n = await c.query("SELECT count(*)::int AS n FROM products")
    if (n.rows[0].n === 0) {
      await c.query(`INSERT INTO products (title,section,region,image,stock,variants,badges,description,full_description,sort_order)
        VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,0)`,
        ["Fleur CBD Amnesia","fleurs","both",null,100, JSON.stringify([{qty:5,price:25},{qty:10,price:45}]), JSON.stringify(["nouveau"]),
         "CBD légal THC < 0,3 %","Fleur CBD qualité premium. THC < 0,3 %."])
    }
    await c.query(`INSERT INTO promo_codes (code,type,value,min_amount,active) VALUES ('BIENVENUE10','percent',10,40,true) ON CONFLICT (code) DO NOTHING`)
    await c.query("COMMIT")
    console.log("Seed OK")
  } catch(e) { await c.query("ROLLBACK"); console.error(e); process.exit(1) }
  finally { c.release(); await pool.end() }
}
main()
