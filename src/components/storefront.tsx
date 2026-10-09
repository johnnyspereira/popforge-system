"use client";

import { ArrowRight, Box, Check, Menu, Minus, Plus, Search, ShoppingBag, Sparkles, Truck, X } from "lucide-react";
import { useMemo, useState } from "react";

const products = [
  { id: 1, name: "Dragão Articulado", category: "Colecionáveis", price: 24.9, tone: "violet", icon: "🐉", tag: "Mais vendido" },
  { id: 2, name: "Luminária Lunar", category: "Casa & Luz", price: 39.9, tone: "amber", icon: "🌕", tag: "Novo" },
  { id: 3, name: "Suporte Headset", category: "Gaming", price: 29.5, tone: "cyan", icon: "🎧", tag: "Personalizável" },
  { id: 4, name: "Vaso Geométrico", category: "Decoração", price: 18.9, tone: "coral", icon: "🌿", tag: "Eco PLA" },
];

type Cart = Record<number, number>;

export function Storefront() {
  const [cart, setCart] = useState<Cart>({});
  const [open, setOpen] = useState(false);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const total = useMemo(() => products.reduce((sum, p) => sum + p.price * (cart[p.id] ?? 0), 0), [cart]);
  const change = (id: number, delta: number) => setCart((old) => ({ ...old, [id]: Math.max(0, (old[id] ?? 0) + delta) }));

  return <>
    <div className="announcement">Envio grátis em Portugal Continental a partir de 50 €</div>
    <header>
      <a className="brand" href="#"><span>POP</span>FORGE<i /></a>
      <nav><a href="#loja">Loja</a><a href="#personalizar">Personalizar</a><a href="#processo">Como funciona</a><a href="#sobre">Sobre</a></nav>
      <div className="actions"><button aria-label="Pesquisar"><Search /></button><button className="cart-button" onClick={() => setOpen(true)} aria-label={`Carrinho com ${count} artigos`}><ShoppingBag /><b>{count}</b></button><button className="mobile"><Menu /></button></div>
    </header>

    <main>
      <section className="hero">
        <div className="hero-copy"><div className="eyebrow"><Sparkles /> Fabricado camada a camada em Portugal</div><h1>Da imaginação<br />para as tuas <em>mãos.</em></h1><p>Objetos únicos, colecionáveis e peças personalizadas com impressão 3D de alta qualidade. Tu imaginas. Nós damos forma.</p><div className="hero-buttons"><a className="primary" href="#loja">Descobrir coleção <ArrowRight /></a><a className="secondary" href="#personalizar">Criar peça personalizada</a></div><div className="proof"><span><Check /> Produção local</span><span><Check /> Materiais responsáveis</span><span><Check /> Feito para ti</span></div></div>
        <div className="hero-art"><div className="orb orb-one"/><div className="orb orb-two"/><div className="print-card"><div className="printer"><div className="rail"/><div className="nozzle"/><div className="model">◆</div><div className="bed"/></div><span>EM PRODUÇÃO</span><strong>A tua ideia, a ganhar forma.</strong><small>Precisão de 0,12 mm · PLA Premium</small></div><div className="layer-tag">327 <small>camadas</small></div></div>
      </section>

      <section className="categories"><span>Explora por universo</span><div><a href="#loja">Colecionáveis</a><a href="#loja">Gaming</a><a href="#loja">Decoração</a><a href="#loja">Organização</a><a href="#personalizar">Personalizados</a></div></section>

      <section className="products" id="loja"><div className="section-head"><div><span className="kicker">ESCOLHIDOS PARA TI</span><h2>Peças com personalidade.</h2></div><a href="#loja">Ver toda a coleção <ArrowRight /></a></div><div className="grid">{products.map((p) => <article key={p.id}><div className={`product-image ${p.tone}`}><span className="tag">{p.tag}</span><span className="product-icon">{p.icon}</span><button onClick={() => { change(p.id, 1); setOpen(true); }} aria-label={`Adicionar ${p.name}`}><Plus /></button></div><p>{p.category}</p><h3>{p.name}</h3><strong>{p.price.toFixed(2).replace(".", ",")} €</strong></article>)}</div></section>

      <section className="custom" id="personalizar"><div><span className="kicker">IMPRESSÃO À MEDIDA</span><h2>Tens uma ideia?<br/><em>Nós materializamos.</em></h2><p>Envia-nos o teu modelo 3D ou conta-nos o que imaginas. Afinamos contigo os detalhes, material e acabamento.</p><a className="light-button" href="mailto:ola@popforge.pt">Pedir orçamento <ArrowRight /></a></div><div className="steps"><div><b>01</b><span><strong>Partilha a ideia</strong><small>Ficheiro 3D, desenho ou apenas uma descrição.</small></span></div><div><b>02</b><span><strong>Afinamos os detalhes</strong><small>Material, cor, tamanho e acabamento.</small></span></div><div><b>03</b><span><strong>Nós damos-lhe forma</strong><small>Produção cuidada e entrega à tua porta.</small></span></div></div></section>

      <section className="values" id="processo"><div><Box/><strong>Feito em Portugal</strong><span>Produção local e cuidada</span></div><div><Sparkles/><strong>Peças únicas</strong><span>Personalização sem limites</span></div><div><Truck/><strong>Entrega acompanhada</strong><span>Segue cada fase da encomenda</span></div></section>
    </main>

    <footer id="sobre"><a className="brand inverse" href="#"><span>POP</span>FORGE<i /></a><p>Ideias que ganham forma.</p><small>© 2026 POPForge. Produzido em Portugal.</small></footer>

    {open && <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}><aside className="drawer"><div className="drawer-head"><h2>O teu carrinho</h2><button onClick={() => setOpen(false)}><X /></button></div>{count === 0 ? <div className="empty"><ShoppingBag/><h3>A tua caixa ainda está vazia</h3><p>Descobre uma peça capaz de mudar isso.</p><button onClick={() => setOpen(false)}>Explorar coleção</button></div> : <><div className="cart-lines">{products.filter((p) => cart[p.id]).map((p) => <div className="cart-line" key={p.id}><span className={`thumb ${p.tone}`}>{p.icon}</span><div><strong>{p.name}</strong><small>{p.price.toFixed(2).replace(".", ",")} €</small><div className="quantity"><button onClick={() => change(p.id,-1)}><Minus/></button><b>{cart[p.id]}</b><button onClick={() => change(p.id,1)}><Plus/></button></div></div></div>)}</div><div className="cart-total"><span>Total</span><strong>{total.toFixed(2).replace(".", ",")} €</strong></div><button className="checkout">Finalizar encomenda <ArrowRight/></button><small className="demo-note">Checkout será ligado ao Stripe na próxima fase.</small></>}</aside></div>}
  </>;
}
