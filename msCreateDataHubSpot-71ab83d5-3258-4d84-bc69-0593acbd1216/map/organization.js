module.exports = {
  name: {
    type: "string",
    reference: "name",
  },
  cnpj: {
    type: "string",
    reference: "document_identification_primary",
  },
  hs_lead_status: {
    type: "string",
    reference: "",
    default: "Aguardando vigência",
  },
};
