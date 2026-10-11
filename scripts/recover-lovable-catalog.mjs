import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const auditDirectory = path.join(process.env.TEMP || ".", "popforge-lovable-audit");
const source = await readFile(path.join(auditDirectory, "catalog-fragment.txt"), "utf8");

const assets = {
  Ie: "product-1-Dde6SHFT.jpg",
  Le: "product-2-CPMdkI3s.jpg",
  Re: "product-3-6gDmKAVq.jpg",
  ze: "product-4-Cz_zq3cS.jpg",
  Be: "product-5-CBk565E3.jpg",
  Ve: "product-6-CNNFPMZF.jpg",
  He: "product-7-VU932gR3.jpg",
  Ue: "product-8-BJ53jI5K.jpg",
  We: "product-9-R9fAMCkk.jpg",
  Ge: "product-10-DOnf3qxB.jpg",
  G: "product-11-CwxwymBM.jpg",
  Ke: "product-12-qpmwY34U.jpg",
  qe: "product-car-5Gf7ww-7.jpg",
  Je: "product-signs-DRmGiEmE.jpg",
  Ye: "product-planter-BudddLOK.jpg",
  Xe: "product-stand-BcuGeJrZ.jpg",
  Ze: "product-trophy-DEQXR020.jpg",
  Qe: "product-dock-TwtyE30O.jpg",
  $e: "product-drawer-DTKx3j_3.jpg",
  et: "products-a-DstxeCgh.jpg",
  tt: "products-b-BifeVagY.jpg",
  nt: "products-c-zLnFLmik.jpg",
};

const start = source.indexOf("dt=") + 3;
const end = source.indexOf(",ft=e=>", start);
if (start < 3 || end < 0) throw new Error("Catalog expression not found.");
const expression = source.slice(start, end);
const argumentNames = [...Object.keys(assets), "ut", "lt"];
const argumentValues = [
  ...Object.values(assets).map((filename) => `/lovable/${filename}`),
  (...entries) => entries.map(([label, delta]) => ({ label, delta })),
  ["Azul elétrico", "Off-white", "Grafite"],
];
// The expression is data recovered from the published POPFORGE bundle. It is
// evaluated only by this maintainer script, never from a request or at runtime.
const products = Function(...argumentNames, `return (${expression})`)(...argumentValues);

const categories = [
  ["casa-organizacao", "Casa & Organização", assets.We],
  ["secretaria-escritorio", "Secretária & Escritório", assets.ze],
  ["tecnologia", "Tecnologia", assets.Xe],
  ["carro", "Carro", assets.qe],
  ["decoracao", "Decoração", assets.Be],
  ["personalizados", "Personalizados", assets.He],
  ["presentes", "Presentes", assets.Ve],
  ["empresas", "Empresas", assets.G],
].map(([slug, name, image]) => ({ slug, name, image: `/lovable/${image}` }));

await mkdir("src/data", { recursive: true });
await writeFile(
  "src/data/lovable-catalog.json",
  `${JSON.stringify({ categories, products }, null, 2)}\n`,
  "utf8",
);

const publicDirectory = path.join("public", "lovable");
await mkdir(publicDirectory, { recursive: true });
for (const filename of new Set(Object.values(assets))) {
  const response = await fetch(`https://popforge-clone.lovable.app/assets/${filename}`);
  if (!response.ok) throw new Error(`Could not download ${filename}: ${response.status}`);
  await writeFile(path.join(publicDirectory, filename), Buffer.from(await response.arrayBuffer()));
}

console.log(`Recovered ${products.length} products, ${categories.length} categories and ${Object.keys(assets).length} assets.`);
