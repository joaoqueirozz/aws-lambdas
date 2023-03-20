async function execute(id, models, utils, type, patient) {
  let data = await models.Beneficiary.query()
    .where(patient ? "life_id" : "id", id)
    .orderBy("created_at", "desc")
    .withGraphFetched(
      "[companies.[company_locations, company_contacts], lives.[life_locations, life_contacts], grace_types]"
    )
    .withGraphFetched("contracts")
    .withGraphFetched("health_plans");

  if (data.length > 0) {
    if (data[0].lives && data[0].lives.holder_id) {
      const beneficiary = await models.Beneficiary.query()
        .where("life_id", data[0].lives.holder_id)
        .withGraphFetched("lives.[life_locations, life_contacts]")
        .withGraphFetched("contracts")
        .withGraphFetched("health_plans");

      data[0].lives["holder"] = beneficiary[0];
    }

    return data[0];
  } else return null;
}

module.exports = {
  execute,
};
