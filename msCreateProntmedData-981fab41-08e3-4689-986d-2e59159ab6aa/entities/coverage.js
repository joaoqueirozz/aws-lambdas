async function execute(id, models, patient) {
  let data = await models.Beneficiary.query()
    .where(patient ? "life_id" : "id", id)
    .orderBy("created_at", "desc")
    .withGraphFetched("lives.[life_locations, life_contacts]");

  if (data.length > 0) {
    if (data[0] && data[0].holder_id) {
      const beneficiary = await models.Beneficiary.query()
        .where("id", data[0].holder_id)
        .withGraphFetched("lives.[life_locations, life_contacts]");
      data[0]["holder"] = beneficiary[0];
    }
    return data[0];
  } else {
    return null;
  }
}

module.exports = {
  execute,
};
