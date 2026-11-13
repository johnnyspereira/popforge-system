/** Notas de versão apresentadas nas definições do CRM. */
export const releaseNotes = [
  {
    date: '2026-11-13',
    areas: ['Catálogo', 'Loja pública'],
    title: 'Tipo PACK configurável no catálogo',
    description: 'O editor passou a permitir selecionar PACK como tipo de produto. A loja pública mostra a etiqueta PACK e a base de dados aceita este novo tipo.',
    usage: 'No editor do produto, abra Tipo e escolha Pack. A migração 067 deve estar aplicada no cPanel.',
  },
  {
    date: '2026-11-13',
    areas: ['Catálogo', 'Loja pública'],
    title: 'Tags visuais para tipos de produto',
    description: 'Produtos KIT, PACK, por encomenda e pronta entrega passam a ter uma etiqueta colorida no catálogo e na loja pública.',
    usage: 'O tipo é determinado no editor do produto; produtos com “Pack” no nome recebem a etiqueta PACK até existir um campo de tipo PACK dedicado.',
  },
  {
    date: '2026-11-13',
    areas: ['Catálogo', 'Kits'],
    title: 'Produtos normais não dependem da migração de kits',
    description: 'Corrigida a gravação de peças prontas e produzidas por encomenda quando a tabela opcional de componentes de KIT ainda não existe no runtime.',
    usage: 'Edite e guarde produtos que não são KIT normalmente; a migração só é exigida ao criar ou editar um KIT.',
  },
  {
    date: '2026-11-13',
    areas: ['Catálogo'],
    title: 'Variantes acessíveis no produto agrupado',
    description: 'Cada produto continua a aparecer uma vez, mas as variantes ficam visíveis como opções dentro da linha e podem ser editadas individualmente.',
    usage: 'No catálogo, selecione a variante por cor, material ou SKU para abrir o editor correspondente.',
  },
  {
    date: '2026-11-13',
    areas: ['Catálogo'],
    title: 'Variantes agrupadas por produto',
    description: 'A listagem do catálogo mostra cada produto apenas uma vez. As variantes continuam disponíveis no editor e são contabilizadas no produto.',
    usage: 'Abra Catálogo; produtos com várias cores ou materiais aparecem numa única linha.',
  },
  {
    date: '2026-11-13',
    areas: ['Loja pública', 'Site público'],
    title: 'Configurações do editor aplicadas à loja',
    description: 'A loja pública passa a ler do editor o selo, título, subtítulo, imagem principal e cores do hero. O catálogo e as coleções continuam a ser carregados da conta POPForge.',
    usage: 'Edite Site público → Identidade e publique. Abra a loja pública para ver as alterações.',
  },
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
