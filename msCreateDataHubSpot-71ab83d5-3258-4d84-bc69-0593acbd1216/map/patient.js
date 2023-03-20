module.exports = {
  firstname: {
    type: "string",
    reference: "lives.name",
  },
  lastname: {
    type: "string",
    reference: "",
  },
  cpf: {
    type: "string",
    reference: "lives.document_identification_primary",
  },
  data_de_nascimento: {
    type: "datetime",
    format: "yyyy-mm-dd",
    reference: "lives.birth_at",
  },
  email: {
    type: "string",
    reference: "lives.life_contacts.email",
  },
  phone: {
    type: "string",
    reference: "lives.life_contacts.phone_mobile",
    default: "+55",
  },
  data_de_vigencia: {
    type: "datetime",
    format: "yyyy-mm-dd",
    reference: "start_at",
  },
  tipo_do_contato: {
    type: "string",
    reference: "",
    default: "Membro - Aguardando vigência",
  },
  hs_lead_status: {
    type: "string",
    reference: "",
    default: "Aguardando vigência",
  },
  carteirinha: {
    type: "string",
    reference: "lives.health_card_number",
    default: "",
  },
  data_de_vencimento: {
    type: "datetime",
    format: "yyyy-mm-dd",
    reference: "contracts.payment_at",
  },
  dia_do_pagamento: {
    type: "datetime",
    format: "dd",
    reference: "contracts.next_payment_at",
    default: "",
  },
  forma_de_pagamento: {
    type: "enum",
    reference: "contracts.payment_method_source_value",
    default: "3",
  },
};
