# Kasimir template

A browser-side template system library. Nothing more.

- Small footprint
- Oriented on angular / vuejs templates
- Maintain existing objects
- Complete eval'ed() javscript expressions wherever possible
- Based on web components
- Fits into one ethernet frame (1500 Byte) when gzip handler is active

## Example

The Template:

```html
<template is="ka-tpl" id="tpl01">
    <div *for="let row of rows indexby idx" *if="idx < 20" id="tpl1">
        <div [classlist.success]="$.row.success === true">{{ row.msg }}</div>
    </div>
</template>
```

```javascript
let data = {
   rows: [
       {success: false, msg: "failed"}
   ]
};
ka_tpl("tpl01").$scope = data;
```


## Installation

Use cdn


Use npm

Copy 'n paste


## Usage

### Access the scope

### Modify dom attributes

Within templates you can use javascript expressions to set attributes, css-classes and directly
access properties:

| Binding | Description |
|---------|-------------|
| `[attrName]`      | Set a dom attribute     |
| `[.cssClassName]` | Set/Unset css class     |
| `(property)`      | Set a property          |

**Set attributes**

```html
<input [value]="expression">
```

**Set css classes**

```html
<div [classlist.<classname>]="(bool)expression">
```

### IF conditions

### ka-tpl: Template

Defines a template.

```html
<template is="ka-tpl"
    [auto="function(this)"]
    [afterrender="function(this)"]
    [debug]
>
...template...
</template>
```

| Attr              | Description |
|-------------------|-------------|
| `stmt`            | The statement to load the value |
| `auto`            | Render automatically on connected (only outside templates) |
| `afterrender`     | Run code after the element was rendered |
| `debug`           | Output log messages to console.log() for this element |


### ka-val: Print a value

```html
<ka-val 
    stmt="js-code"          <!-- Statement to load the value to disply -->
    [auto]                  <!-- Render automaticly without template --> 
    [afterrender="function(this)"]
    [html]
>Value before rendering</ka-val>
```

| Attr              | Description |
|-------------------|-------------|
| `stmt`            | The statement to load the value |
| `auto`            | Render automatically on connected (only outside templates) |
| `afterrender`     | Run code after the element was rendered |


**Example**

Print a value loaded 
