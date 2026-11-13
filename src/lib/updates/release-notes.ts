/** Notas de versão apresentadas nas definições do CRM. */
export const releaseNotes = [
  {
    date: '2026-11-13',
    areas: ['Site público', 'Catálogo'],
    title: 'Preview associado ao catálogo POPForge',
    description: 'O editor do site passa a carregar os produtos ativos do catálogo da conta e mostra nome, imagem e preço reais na pré-visualização.',
    usage: 'Publique produtos em Loja e produção → Catálogo; ao abrir Site público, eles aparecem automaticamente no preview.',
  },
  {
    date: '2026-11-12',
    areas: ['Site público'],
    title: 'Editor do site com erros visíveis',
    description: 'O editor deixou de ficar preso no carregamento e apresenta uma mensagem clara quando a API ou as migrações MySQL não estão disponíveis. O botão de guardar também informa quando a conta não tem permissão de publicação.',
    usage: 'Abra Site público, edite os campos e selecione Guardar e publicar.',
  },
];
