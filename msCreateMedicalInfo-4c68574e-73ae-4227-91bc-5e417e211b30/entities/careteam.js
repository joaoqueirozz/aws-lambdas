const utils = require("utils");

function extend(dest, src) {
    for (var key in src) {
        dest[key] = src[key];
    }
    return dest;
}

async function executeTransaction(models, event, schema, trx) {
    try {
        // obtém os participantes do care team
        const practitionersArr = Object.assign([], event.data.main.data.practitioners);

        // remove eles do objeto original
        delete event.data.main.data.practitioners;
        delete event.data.main.data.patients;

        // insere a empresa
        const ids = await models.CareTeam.knex().insert(event.data.main.data, 'id').into(`${schema}.care_teams`).transacting(trx);

        // formata o id da empresa que acabou de ser inserida
        const insertedId = parseInt(ids[0], 10);

        // verifica entidades aninhadas
        const locationsObj = event.data.secondary['care_team_locations'];

        // insere o endereço
        if (locationsObj) {
            locationsObj.care_team_id = insertedId;
            await models.CareTeam.knex().insert(locationsObj).into(`${schema}.care_team_locations`).transacting(trx);
        }

        // monta o grupo de médicos
        const careTeamProviders = [];
        for (let i = 0; i < practitionersArr.length; i++) {
            careTeamProviders.push({
                care_team_id: insertedId,
                provider_id: practitionersArr[i].id
            });
        }

        // insere os médicos no care team
        await models.CareTeam.knex().insert(careTeamProviders).into(`${schema}.care_team_providers`).transacting(trx);

        // mergeia os objetos inseridos num só para retorna para o cliente
        extend(event.data.main.data, event.data.secondary['care_team_locations']);
        event.data.main.data.id = insertedId.toString();

        return event.data.main.data;
    } catch (err) {
        throw err;
    }
}

async function execute(models, event) {
    // declara e inicializa o esquema
    const schema = event.db_schema;

    try {
        return await models.CareTeam.knex().transaction(async trx => await executeTransaction(models, event, schema, trx));
    } catch (err) {
        throw err;
    } finally {
        models.destroy();
    }
}

module.exports = {
    execute
}