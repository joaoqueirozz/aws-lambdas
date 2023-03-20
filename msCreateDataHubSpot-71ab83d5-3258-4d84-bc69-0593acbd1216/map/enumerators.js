module.exports = {
  payment_method_enum: {
    unknown: {
      forma_de_pagamento: "Boleto",
    },
    3: {
      forma_de_pagamento: "Boleto",
    },
    4: {
      forma_de_pagamento: "Boleto",
    },
    5: {
      forma_de_pagamento: "Cartão de crédito",
    },
  },
  status_enum: {
    active: {
      tipo_do_contato: "Membro",
    },
    draft: {
      tipo_do_contato: "Membro - Aguardando vigência",
    },
    cancelled: {
      tipo_do_contato: "Membro - Cancelado",
    },
    revoked: {
      tipo_do_contato: "Membro - Inadimplente",
    },
  },
};
