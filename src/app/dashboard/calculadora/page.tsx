import Link from "next/link";
import {ArrowLeft,Calculator,LayoutDashboard,Package,Printer,ShoppingCart,Warehouse} from "lucide-react";
import {PricingCalculator} from "@/components/pricing-calculator";
import "../dashboard.css";
import "./pricing.css";
export const metadata={title:"Calculadora de preços"};
export default function PricingPage(){return <div className="admin"><aside><div className="admin-brand"><span>POP</span>FORGE</div><nav><Link href="/dashboard"><LayoutDashboard/> Visão geral</Link><span><ShoppingCart/> Encomendas</span><span><Package/> Produtos</span><span><Printer/> Produção 3D</span><span><Warehouse/> Inventário</span><b><Calculator/> Calculadora</b></nav><Link href="/"><ArrowLeft/> Voltar à loja</Link></aside><main className="pricing-main"><header><div><small>FORMAÇÃO DE PREÇO</small><h1>Quanto deve custar esta peça?</h1><p>Calcula o custo real, protege a margem e cria preços sustentáveis.</p></div></header><PricingCalculator/></main></div>}
