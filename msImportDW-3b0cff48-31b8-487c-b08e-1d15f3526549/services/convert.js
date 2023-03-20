/**
 * Get value of a given object
 * Similar to [Loadash `get`](https://lodash.com/docs/4.17.15#get)
 * @param {Object} obj - Input object
 * @param {String[]} path - path to be picked
 * @param {String} defaultValue - default value
 * @returns Object
 */
module.exports.get = (obj, path, defaultValue = undefined) => {
    const travel = regexp =>
        String.prototype.split
            .call(path, regexp)
            .filter(Boolean)
            .reduce((res, key) => (res !== null && res !== undefined ? res[key] : res), obj)
    const result = travel(/[,[\]]+?/) || travel(/[,[\].]+?/)
    return result === undefined || result === obj ? defaultValue : result
}

/**
 * Set value of a given object
 * Similar to [Loadash `get`](https://lodash.com/docs/4.17.15#set)
 * @param {Object} obj - Input object
 * @param {String[]} path - path to be picked
 * @param {String} value - properties value
 * @returns Object
 */
module.exports.set = (obj, path, value) => {
    if (Object(obj) !== obj) return obj // When obj is not an object
    // If not yet an array, get the keys from the string-path
    if (!Array.isArray(path)) path = path.toString().match(/[^.[\]]+/g) || []
    path.slice(0, -1).reduce(
        (
            a,
            c,
            i // Iterate all of them except the last one
        ) =>
            Object(a[c]) === a[c] // Does the key exist and is its value an object?
                ? // Yes: then follow that path
                a[c]
                : // No: create the key. Is the next key a potential array-index?
                (a[c] =
                    Math.abs(path[i + 1]) >> 0 === +path[i + 1]
                        ? [] // Yes: assign a new array object
                        : {}), // No: assign a new plain object
        obj
    )[path[path.length - 1]] = value // Finally assign the value to the last key
    return obj // Return the top-level object to allow chaining
}

/**
 * Convert object to another object
 * @param {Object} map - object conversion map
 * @param {Object} entity - entity object
 * @returns Object
 */
module.exports.convert = (map, entity) => {
    let ret = {}

    const properties = Object.getOwnPropertyNames(map)

    for (const element of properties) {
        this.set(ret, element, this.get(entity, map[element].reference) || map[element].default)
    }

    return ret
}

/**
 * Validate and Convert object
 * @param {Object} str - string to convert to object
 * @returns Object
 */
module.exports.validateAndConvertObject = str => {
    try {
        return JSON.parse(str)
    } catch (e) {
        return false
    }
}
