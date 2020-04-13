# Kasimir template

A browser-side template system library. Nothing more.

- Small footprint
- Oriented on angular / vuejs templates
- Complete eval'ed() javscript expressions wherever possible
- Based on web components

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


## Usage

### Access the scope



### IF conditions


