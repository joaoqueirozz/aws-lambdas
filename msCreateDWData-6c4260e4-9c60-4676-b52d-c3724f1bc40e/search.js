async function execute(models, table, field, value) {

    const data = await models[table].query().where(field, value);

    if (data.length > 0) {
        return data[0].id;
    }

    return null;
}

module.exports = {
    execute
}