import Link from "next/link";
import { StorefrontRequestForm } from "@/components/commerce/storefront-request-form";

export function StorefrontInfoPage({ page }: { page: "about" | "faq" | "contact" | "favorites" }) {
  const content = {
    about: { eyebrow: "SOBRE A POPFORGE", title: "Peças que começam numa ideia.", text: "A POPForge combina design, impressão 3D e produção local para criar objetos úteis, presentes e soluções para marcas. Cada encomenda é acompanhada do ficheiro à peça final." },
    faq: { eyebrow: "PERGUNTAS FREQUENTES", title: "Tudo claro antes de produzir.", text: "Trabalhamos com PLA e PETG de acordo com o uso da peça. O prazo, a cor e o acabamento são confirmados antes da produção. Pedidos personalizados e empresariais recebem uma proposta antes de avançar." },
    contact: { eyebrow: "CONTACTOS", title: "Vamos dar forma à sua ideia.", text: "Envie o pedido com o máximo de detalhe possível. A equipa POPForge responde com viabilidade, prazo e proposta." },
    favorites: { eyebrow: "FAVORITOS", title: "Guarde as peças que mais gosta.", text: "Os favoritos serão associados à sua conta numa próxima sessão. Por agora, explore o catálogo e adicione produtos ao carrinho para preparar a encomenda." },
  }[page];
  return <main className="min-h-screen bg-[#071014] px-5 py-12 text-slate-100"><div className="mx-auto max-w-3xl"><Link href="/" className="text-cyan-300">← POPForge</Link><p className="mt-10 text-xs font-bold tracking-[.2em] text-cyan-300">{content.eyebrow}</p><h1 className="mt-3 text-5xl font-black">{content.title}</h1><p className="mt-5 text-lg leading-8 text-slate-400">{content.text}</p>{page === "contact" && <div className="mt-9"><StorefrontRequestForm /></div>}{page === "faq" && <div className="mt-9 space-y-3">{["Posso personalizar uma peça?", "Que materiais utilizam?", "Como funciona o pagamento?"].map((question) => <details key={question} className="rounded-xl border border-white/10 bg-white/[.03] p-4"><summary className="cursor-pointer font-bold">{question}</summary><p className="mt-3 text-sm leading-6 text-slate-400">Sim. Registamos o pedido no CRM e confirmamos os detalhes técnicos e comerciais antes de produzir.</p></details>)}</div>}{page === "favorites" && <Link href="/produtos" className="mt-8 inline-block rounded-xl bg-cyan-300 px-5 py-3 font-bold text-slate-950">Explorar produtos</Link>}</div></main>;
}
