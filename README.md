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
<div *for="let $.row of $.rows index $.idx" *if="$.idx < 20" id="tpl1">
    <div [classlist.success]="$.row.success === true">{{ $.row.msg }}</div>
</div>
```

```javascript
let data = {
   rows: [
       {success: false, msg: "failed"}
   ]
};
kasimir_tpl("tpl1").$ = data;
```


## Installation

Use cdn


Use npm

Copy 'n paste


## Usage

### Access the scope



### IF conditions

### ka-tpl: Template

Defines a template.

```html
<template is="ka-tpl"
    [auto]
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


### ka-val: Value Injection

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


