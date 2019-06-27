# Kasimir template

A vanillajs template client-side renderer.

## Example

The Template:

```html
<template id="tpl1">
    <div *for="let data of scope.list">
        Hello ${data} <button onclick="console.log(data)">View</button>
        <b *if="data == 'Index 6'">This is the 6</b>
    </div>
</template>
```

Render the template:
```javascript

let data = {
    list: [],
    name: "Matthias"
};
let tpl1 = kasimir_tpl("#tpl1").bind("#target").observe(data);
```


