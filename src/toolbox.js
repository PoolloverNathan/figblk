/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/*
This toolbox contains nearly every single built-in block that Blockly offers,
in addition to the custom block 'add_text' this sample app adds.
You probably don't need every single block, and should consider either rewriting
your toolbox from scratch, or carefully choosing whether you need each block
listed here.
*/

export const toolbox = {
  'kind': 'categoryToolbox',
  'contents': [
    {
      'kind': 'category',
      'name': 'Control',
      'categorystyle': 'control_category',
      'contents': [
        {
          "kind": "block",
          type: "_Boolean"
        },
        {
          "kind": "block",
          type: "and"
        },
        {
          "kind": "block",
          type: "and",
          fields: {
            OP: "or"
          }
        },
        {
          'kind': 'block',
          'type': 'if',
        },
        {
          'kind': 'block',
          'type': 'elif',
        },
        {
          'kind': 'block',
          'type': 'else',
        },
        {
          'kind': 'block',
          'type': 'while',
        },
        // {
        //   'kind': 'block',
        //   'type': 'for',
        //   'inputs': {
        //     'FROM': {
        //       'shadow': {
        //         'type': 'math_number',
        //         'fields': {
        //           'NUM': 1,
        //         },
        //       },
        //     },
        //     'TO': {
        //       'shadow': {
        //         'type': 'math_number',
        //         'fields': {
        //           'NUM': 10,
        //         },
        //       },
        //     },
        //     'BY': {
        //       'shadow': {
        //         'type': 'math_number',
        //         'fields': {
        //           'NUM': 1,
        //         },
        //       },
        //     },
        //   },
        // },
        {
          kind: "block",
          type: "break"
        }
      ],
    },
    {
      'kind': 'category',
      'name': 'Tables',
      'categorystyle': 'table_category',
      'contents': [
        {
          kind: "block",
          type: "table",
        },
        {
          kind: "block",
          type: "table_item",
        },
        {
          kind: "block",
          type: "table_key",
        },
        {
          kind: "block",
          type: "getprop"
        }
      ]
    },
    {
      'kind': 'category',
      'name': 'Functions',
      'categorystyle': 'procedure_category',
      'custom': 'PROCEDURE',
    },
    {
      "kind": "category",
      "name": "Advanced",
      "categorystyle": "advanced_category",
      "contents": [
        {
          "kind": "block",
          type: "literal_stmt"
        },
        {
          "kind": "block",
          type: "literal_expr"
        },
        {
          "kind": "block",
          type: "error_stmt"
        },
        {
          "kind": "block",
          type: "error_expr"
        },
        {
          "kind": "block",
          type: "coerce"
        },
      ]
    }
  ],
};
