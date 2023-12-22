// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import * as assert from 'assert';
import { WhenClauseEvaluationContext } from '../../src/utils/configUtils';

suite('ConfigUtils Tests', () => {

    [
        { clause: 'true', expectedResult: true },
        { clause: 'false', expectedResult: false },
        { clause: '!false', expectedResult: true },
        { clause: '!true', expectedResult: false },
        { clause: 'false && false', expectedResult: false },
        { clause: 'false && true', expectedResult: false },
        { clause: 'true && false', expectedResult: false },
        { clause: 'true && true', expectedResult: true },
        { clause: 'false || false', expectedResult: false },
        { clause: 'false || true', expectedResult: true },
        { clause: 'true || false', expectedResult: true },
        { clause: 'true || true', expectedResult: true },
        { clause: 'false == false', expectedResult: true },
        { clause: 'false == true', expectedResult: false },
        { clause: 'true == false', expectedResult: false },
        { clause: 'true == true', expectedResult: true },
        { clause: 'false === false', expectedResult: true },
        { clause: 'false === true', expectedResult: false },
        { clause: 'true === false', expectedResult: false },
        { clause: 'true === true', expectedResult: true },
        { clause: 'false != false', expectedResult: false },
        { clause: 'false != true', expectedResult: true },
        { clause: 'true != false', expectedResult: true },
        { clause: 'true != true', expectedResult: false },
        { clause: 'false !== false', expectedResult: false },
        { clause: 'false !== true', expectedResult: true },
        { clause: 'true !== false', expectedResult: true },
        { clause: 'true !== true', expectedResult: false },
        { clause: '0 > 0', expectedResult: false },
        { clause: '0 > 1', expectedResult: false },
        { clause: '1 > 0', expectedResult: true },
        { clause: '1 > 1', expectedResult: false },
        { clause: '0 >= 0', expectedResult: true },
        { clause: '0 >= 1', expectedResult: false },
        { clause: '1 >= 0', expectedResult: true },
        { clause: '1 >= 1', expectedResult: true },
        { clause: '0 < 0', expectedResult: false },
        { clause: '0 < 1', expectedResult: true },
        { clause: '1 < 0', expectedResult: false },
        { clause: '1 < 1', expectedResult: false },
        { clause: '0 <= 0', expectedResult: true },
        { clause: '0 <= 1', expectedResult: true },
        { clause: '1 <= 0', expectedResult: false },
        { clause: '1 <= 1', expectedResult: true },
        { clause: '"foo" =~ /foo/', expectedResult: true },
        { clause: '\'foo\' =~ /foo/', expectedResult: true },
        { clause: '"foo" =~ /bar/', expectedResult: false },
        { clause: '"foo" =~ /^foo$/', expectedResult: true },
        { clause: '"foo" =~ /\\w+/', expectedResult: true },
        { clause: '"foo" =~ //', expectedResult: true },
        { clause: '"foo" =~ /FOO/', expectedResult: false },
        { clause: '"foo" =~ /FOO/i', expectedResult: true },
        { clause: 'false && true && true || !false', expectedResult: true },
        { clause: 'false && true && (true || !false)', expectedResult: false },
        { clause: '(false && true) && (true || !false)', expectedResult: false },
        { clause: 'false && (true && (true || !false))', expectedResult: false },
    ].forEach(({ clause, expectedResult }) => test(`Evaluate when clause - basic: ${clause}`, () => {
        const context = new WhenClauseEvaluationContext(clause);
        const result = context.evaluate();

        assert.equal(result, expectedResult);
    }));

    [
        { clause: 'test == undefined', expectedResult: false },
        { clause: 'test == "foo"', expectedResult: true },
        { clause: 'test == "bar"', expectedResult: false },
        { clause: 'test != "bar"', expectedResult: true },
        { clause: 'test =~ /foo/', expectedResult: true },
        { clause: 'test =~ /bar/', expectedResult: false },
    ].forEach(({ clause, expectedResult }) => test(`Evaluate when clause - context key: ${clause}`, () => {
        const context = new WhenClauseEvaluationContext(clause);
        context.addContextKey('test', 'foo');

        const result = context.evaluate();

        assert.equal(result, expectedResult);
    }));

    [
        'truefalse',
        'falsetrue',
        'test',
        'test == true',
    ].forEach(clause => test(`Evaluate when clause - missing context key: ${clause}`, () => {
        const context = new WhenClauseEvaluationContext(clause);
        assert.throws(() => context.evaluate(), SyntaxError);
    }));

});
