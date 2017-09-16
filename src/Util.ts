/**
 * Reclass doc generator
 *
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 (c) 2017 Jiri Hybek
 */

import {LOG_LEVEL} from 'meta2-logger';

/**
 * Clones and object
 *
 * @param obj Object to clone
 */
export function clone(obj, exclude: Array<string> = null) {

    var copy;

    // Handle the 3 simple types, and null or undefined
    if (null === obj || "object" != typeof obj) return obj;

    // Handle Date
    if (obj instanceof Date) {
        copy = new Date();
        copy.setTime(obj.getTime());
        return copy;
    }

    // Handle Array
    if (obj instanceof Array) {
        copy = [];
        for (var i = 0, len = obj.length; i < len; i++) {
            copy[i] = clone(obj[i], exclude);
        }
        return copy;
    }

    // Handle Object
    if (obj instanceof Object) {
        copy = {};
        for (var attr in obj) {
            
            if (obj.hasOwnProperty(attr)){
                if(exclude && exclude.indexOf(attr) >= 0)
                    copy[attr] = obj[attr];
                else
                    copy[attr] = clone(obj[attr], exclude);
            }

        }
        return copy;
    }

    throw new Error("Unable to copy obj! Its type isn't supported.");

};

/**
 * Deeply compares two objects
 *
 * @param a First object
 * @param b Second object
 */
export function deepEqual(a: { [K: string]: any; [K: number]: any }, b?: { [K: string]: any; [K: number]: any }, excludeProps?: Array<string>){

    if(!b) return false;

    for(let i in a){

        if(excludeProps && excludeProps.indexOf(i) > 0)
            continue;

        if(a[i] === undefined) return false;

        if(a[i] instanceof Object){

            if(! (b[i] instanceof Object))
                return false;

            let r = deepEqual(a[i], b[i]);

            if(!r) return false;

        } else {

            if(a[i] !== b[i])
                return false;

        }

    }

    return true;

}

/**
 * Returns if array deeply contains target object
 *
 * @param arr Array to traverse
 * @param target Target object to check existence
 */
export function deepContains(arr: Array< { [K: string]: any; [K: number]: any } >, target: any, excludeProps?: Array<string>){

    if(target instanceof Object){

        for(let i = 0; i < arr.length; i++){

            if(!(arr[i] instanceof Object))
                if(arr[i] === target) return true;

            if(deepEqual(arr[i], target, excludeProps))
                return true;

        }

        return false;

    } else {

        return arr.indexOf(target) >= 0 ? true : false;

    }

}

/**
 * Merges objects
 */
export function merge(...objs){

    let res = {};

    for(let i = 0; i < objs.length; i++)
        for(let k in objs[i])
            res[k] = objs[i][k];

    return res;

}

/**
 * Class type
 */
export enum CLASS_TYPE {
    CLASS,
    NODE
}

/**
 * Class name interface
 */
export interface IClassName {
    path: string;
    fullName: string;
    name: string;
    type: CLASS_TYPE,
    isInit: boolean;
}

/**
 * Parses class name from path
 *
 * @param path Path
 * @param delimiter Path delimiter
 */
export function parseClassName(type: CLASS_TYPE, path: string, delimiter: string = "/") : IClassName {

    let parts = path.split(delimiter);
    let nameParts = [];
    let isInit = false;

    for(let i in parts)
        if(parts[i].trim() != "")
            nameParts.push(parts[i]);

    if(nameParts[nameParts.length - 1] == "init"){
        isInit = true;
        nameParts.pop();
    }

    return {
        path: path,
        fullName: nameParts.join("."),
        name: nameParts[nameParts.length - 1] || null,
        type: type,
        isInit: isInit
    }

}

/**
 * Parses log level from string to logger level
 *
 * @param level Log level
 */
export function parseLogLevel(level: string){

    switch(level.toLowerCase()){

        case 'break':
            return LOG_LEVEL.BREAK;
        case 'debug':
            return LOG_LEVEL.DEBUG;
        case 'info':
            return LOG_LEVEL.INFO;
        case 'warn':
        case 'warning':
            return LOG_LEVEL.WARN;
        case 'error':
            return LOG_LEVEL.ERROR;

        default:
            throw new Error("Unknown log level '" + level + "'.");

    }

}