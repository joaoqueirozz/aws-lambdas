async function execute(id, models, utils, mergeOptions, _, type, identifier) {
    if (id) {
        const groups = await models.CareTeamLives
            .query()
            .where('id', id);

        if (groups.length > 0) {
            const patients = groups.map(item => {
                return parseInt(item.life_id, 10);
            });

            return {
                id: groups[0].id,
                type: 'person',
                actual: true,
                patients
            }
        } else {
            throw utils.buildCustomError(404, 'Recurso não encontrado');
        }
    } else {
        throw utils.buildCustomError(400, 'Informe o id do recurso');
    }
}

module.exports = {
    execute
}