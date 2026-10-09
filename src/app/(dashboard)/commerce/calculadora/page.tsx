import { PricingCalculator } from '@/components/pricing-calculator';
import './pricing.css';

export const metadata = { title: 'Calculadora de preços | POPForge' };

export default function PricingCalculatorPage() {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header>
        <p className="text-sm font-semibold text-cyan-600">Custos e rentabilidade</p>
        <h1 className="text-3xl font-semibold tracking-tight">Calculadora de preços 3D</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Calcule material, tempo de impressão, energia, embalagem, perdas e margem antes de publicar o produto.</p>
      </header>
      <PricingCalculator />
    </div>
  );
}
