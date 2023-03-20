module.exports = {
  async execute(models, { start, end }) {
    const data = await models.Payment.query()
      .where("updated_at", ">=", start)
      .where("updated_at", "<", end)
      .withGraphFetched("beneficiaries");
    return data;
  },
};
