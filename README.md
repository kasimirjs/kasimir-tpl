# Kasimir template

A browser-side template system library. Nothing more.

- Small footprint
- Oriented on angular / vuejs templates
- Based on web components
    - Supported by all new browsers
    - Very easy to understand the source code

## Example

The Template:

```html
<div *for="let $.row in $.rows" id="tpl1">
    <div [classlist.success]="$.row.success === true">{{ $.row.msg }}</div>
</div>
```

```javascript
let data = {
   rows: [
       {success: false, msg: "failed"}
   ]
};
let tpl = kasimir_tpl("tpl1");
tpl.render(data);
```


## Installation

Use cdn


Use npm

Copy 'n paste

