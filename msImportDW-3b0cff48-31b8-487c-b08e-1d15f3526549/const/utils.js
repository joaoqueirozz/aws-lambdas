module.exports.getResourceIdentifier = (resource) => {
  const propTypes = {
    company: {
      resource: "companies",
      searchResource: "companies",
      identifier: "document_identification_primary",
      searchIdentifier: "document_identification_primary",
    },
    contract: {
      resource: "contracts",
      searchResource: "companies",
      identifier: "company_contractor_company_id",
      searchIdentifier: "document_identification_primary",
    },
    life: {
      resource: "lives",
      searchResource: "lives",
      identifier: "document_identification_primary",
      searchIdentifier: "document_identification_primary",
    },
    beneficiary: {
      resource: "beneficiaries",
      searchResource: "lives",
      identifier: "life_id",
      searchIdentifier: "document_identification_primary",
    },
    health_plans: {
      resource: "health_plans",
      searchResource: "health_plans",
      identifier: "national_code",
      searchIdentifier: "national_code",
    },
    health_plan_costs: {
      resource: "health_plan_costs",
      searchResource: "health_plan_costs",
      identifier: "id",
      searchIdentifier: "id",
    },
  };

  return resource ? propTypes[resource] : null;
};
