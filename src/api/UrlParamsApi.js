/*
 * This file is part of React-SearchKit.
 * Copyright (C) 2018 CERN.
 *
 * React-SearchKit is free software; you can redistribute it and/or modify it
 * under the terms of the MIT License; see LICENSE file for more details.
 */

import Qs from 'qs';
import _isNaN from 'lodash/isNaN';
import _isNil from 'lodash/isNil';

const pushHistory = query => {
  if (window.history.pushState) {
    window.history.pushState({ path: query }, '', query);
  }
};

/** Default URL parser implementation */
class UrlParser {
  _sanitizeParamValue = value => {
    let parsedValue = parseInt(value);
    if (_isNaN(parsedValue)) {
      try {
        const _value = JSON.parse(value);
        if (!_isNil(_value)) {
          parsedValue = _value;
        }
      } catch (e) {
        if (value !== 'undefined') {
          parsedValue = value;
        } else {
          console.error(`Cannot parse value ${value} for param ${key}.`);
        }
      }
    }
    return parsedValue;
  };

  /**
   * Parse the URL query string and return an object with all the params.
   * @param {string} queryString the query string to parse
   */
  parse = (queryString = '') => {
    const parsedParams = Qs.parse(queryString, { ignoreQueryPrefix: true });
    const params = {};
    Object.entries(parsedParams).forEach(entry => {
      const key = entry[0];
      const value = entry[1];
      params[key] = this._sanitizeParamValue(value);
    });
    return params;
  };
}

/** Default implementation for a param validator class */
export class ParamValidator {
  /**
   * Return true if the param value is valid, false otherwise
   * @param {object} queryState the `query` state
   * @param {boolean} updateUrlParams a flag to push the new updated version of `query` state to the URL query string
   */
  isValid = (key, value) => true;
}

/** Object responsible to update the URL query string and parse it to update the app state */
export class UrlParamsApi {
  constructor(config = {}) {
    this.urlParamsMapping = config.urlParamsMapping || {
      queryString: 'q',
      sortBy: 'sort',
      sortOrder: 'order',
      page: 'p',
      size: 's',
      layout: 'l',
      aggregations: 'aggr',
    };

    this.paramValidator = config.paramValidator || new ParamValidator();
    this.urlParser = config.urlParser || new UrlParser();

    // build the serializer from URL params to state by flipping the url params serializer
    this.fromParamsMapping = {};
    Object.keys(this.urlParamsMapping).forEach(stateKey => {
      this.fromParamsMapping[this.urlParamsMapping[stateKey]] = stateKey;
    });
  }

  _transformQueryToUrlParams(queryState) {
    const params = {};
    Object.keys(queryState)
      .filter(stateKey => stateKey in this.urlParamsMapping)
      .filter(stateKey => {
        // filter out negative or null values
        if (
          (stateKey === 'page' || stateKey === 'size') &&
          queryState[stateKey] <= 0
        ) {
          return false;
        }
        return queryState[stateKey] !== null;
      })
      .forEach(stateKey => {
        const paramKey = this.urlParamsMapping[stateKey];
        params[paramKey] = queryState[stateKey];
      });

    // will omit undefined and null values from the query
    return Qs.stringify(params, {
      addQueryPrefix: true,
      skipNulls: true,
    });
  }

  _mergeParamsIntoState(params, queryState) {
    Object.keys(params).forEach(paramKey => {
      const stateKey = this.fromParamsMapping[paramKey];
      if (this.paramValidator.isValid(paramKey, params[paramKey])) {
        if (stateKey in queryState) {
          queryState[stateKey] = params[paramKey];
        }
      }
    });
    return queryState;
  }

  /**
   * Return a new version of the given `query` state with updated values parsed from the URL query string.
   * @param {object} queryState the `query` state
   * @param {boolean} pushUpdate a flag to push the new updated version of `query` state to the URL query string.
   *                             Normally false when setting the initial state on app load, true otherwise.
   */
  get = (queryState, pushUpdate) => {
    const currentParams = this.urlParser.parse(window.location.search);
    const newQueryState = this._mergeParamsIntoState(currentParams, queryState);
    if (pushUpdate) {
      this.set(newQueryState);
    }
    return newQueryState;
  };

  /**
   * Update the URL query string parameters from the given `query` state
   * @param {object} stateQuery the `query` state
   */
  set = stateQuery => {
    const newUrlParams = this._transformQueryToUrlParams(stateQuery);
    pushHistory(newUrlParams);
  };
}
