# Roadmap POPForge

## Princípios

- Repositório, base de dados, variáveis, armazenamento e deploy independentes.
- Reaproveitar padrões comprovados do CRM, nunca dados ou credenciais da JP Massagem.
- Catálogo e checkout orientados a produtos prontos e encomendas personalizadas.

## Fase 1 — Fundação

- Identidade visual, montra, catálogo demonstrativo e dashboard.
- Modelo de clientes, produtos, variantes, encomendas, produção e inventário.

## Fase 2 — Comércio real

- Autenticação administrativa e portal do cliente.
- CRUD de produtos, variantes, imagens e stock.
- Carrinho persistente, moradas, portes e checkout Stripe.
- Webhooks idempotentes e emails transacionais.

## Fase 3 — Oficina 3D

- Upload privado de STL/OBJ/3MF.
- Orçamentos, aprovação e pagamento.
- Fila por impressora, tempos, consumo de material e controlo de qualidade.
- Fotografias de progresso e estados visíveis no portal.

## Fase 4 — CRM e crescimento

- Inbox e WhatsApp transacional.
- Segmentação, campanhas, carrinho abandonado e pós-venda.
- Margem por produto, capacidade, previsões e relatórios.

## Segurança

- Row Level Security, verificação de assinatura Stripe, rate limiting e auditoria.
- Uploads com URL assinada e validação de formato/tamanho.
- RGPD: consentimento, exportação, retenção e eliminação de dados.
