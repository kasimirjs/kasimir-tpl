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
    <div *for="let row of rows indexby idx" *if="idx < 20">
        <div [classlist.success]="row.success === true">{{ row.msg }} <a href="" [on.click]="alert(`click ${idx}: ${row.msg}`);">info</a></div>
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

**Use the minified version (~9k)**
```html
<script src="https://raw.githubusercontent.com/kasimirjs/kasimir-tpl/master/dist/kasimir-tpl-min.js"></script>
```

**Use the combined version with sourcemap and comments (~90k)**
```html
<script src="https://raw.githubusercontent.com/kasimirjs/kasimir-tpl/master/dist/kasimir-tpl.js"></script>
```

## Usage

There is no tooling necessary to define and use your templates.

### Defining a template

A kasimir template is always a web-component extension of the `<template>` element.
The benefit: `<template>`-Elements will not be rendered by default. You must specify
the attribute `is="ka-tpl"` to make the template a kasimir template. 
(See [WebComponents Specs](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements))

```html
<template is="ka-tpl" id="myTpl01" >..tpldata..</template>
```

You can access the template directly with 

```javascript
document.getElementById("myTpl01").$scope = {};
```

Or you use the `ka_tpl()` function to also have code-completion and verify the template:

```javascript
ka_tpl("myTpl01").$scope = {};
```


### Conditions

```html
<div *if="data.name === 'jens'">
    Hello Jens
</div>
```

### Loops

```html
<div *for="let x of data">
    This elements value is {{ x }}
</div>
```

**Syntax**

```
let <varName> of|in|repeat <inVar> [indexby <varname>]
```

### Events

You can register events on every node. The base node will be cloned
and made available to the node also inside loops.

```html
<a href="" [on.click]="alert()">click me</a>
```

### CSS Classes

```html
<a href="" [classlist.className1]="name === 'someValue'">click me</a>
```

```html
<a href="" [classlist.]="{'text-success': name === 'someValue', 'text-danger': name !== 'someValue'}">click me</a>
```

### CSS Styles

```html
<a href="" [style.text-size]="textSize">click me</a>
```

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


## Element specs

In this section the web components defined by kasimir tpl are 
listed and defined.

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


## The KaTemplate class

### Wait for a Element to be rendered

```
<template is="ka-tpl" id="tpl01" debug="" auto="">
    <script>
        (async(self) =>  {
            let input = await self.waitRef("input1");
            // Now input1 is rendered
            input.value = "Hello World!";
        })(KaTpl.self);
    </script>
    <input type="text" *ref="input1">

</template>
```

**Example**

Print a value loaded 
