module.exports = {
  company_id: {
    type: "relationship",
    convert: "OrganizationControl.id_hubspot",
    reference: "company_id",
  },
};
