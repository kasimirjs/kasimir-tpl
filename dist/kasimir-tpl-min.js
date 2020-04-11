/**
 * Infracamp's Kasimir Templates
 *
 * A no-dependency render on request
 *
 * @author Matthias Leuffen <m@tth.es>
 */
class KtRenderable extends HTMLTemplateElement{renderRecursive(e,t,s){if("function"!=typeof e.render){if(!e.hasOwnProperty("ktOwner")||!0===s)for(let s of e.childNodes){if(!0===e.ktSkipRender)return;this.renderRecursive(s,t)}}else e.render(t)}}function kt_tpl(e){if(e instanceof KtTpl)return e;let t=document.getElementById(e);if(t instanceof KtTpl)return t;throw`Selector '${e}' is not a <kt-tpl> element`}var KT_FN={"kt-classes":function(elem,val,scope){"use strict";try{var classes=null;let e="classes = "+val,ret=eval(e);console.log("eval",e,"ret: ",ret,"classes:",classes)}catch(e){throw e+" in [data] of "+elem.outerHTML}for(let e in classes)classes.hasOwnProperty(e)&&(!0===classes[e]?elem.classList.add(e):elem.classList.remove(e))},"kt-attrs":function(elem,val,scope){try{var classes=null;let e="classes = "+val,ret=eval(e);console.log("eval",e,"ret: ",ret,"classes:",classes)}catch(e){throw e+" in *attrs of "+elem.outerHTML}for(let e in classes)classes.hasOwnProperty(e)&&(null!==classes[e]?elem.setAttribute(e,classes[e]):elem.setAttribute(e,""))}};class KtFor extends KtRenderable{constructor(){super(),this.elements=[],this.params={forselect:null,foridx:"idx",foreval:null}}static get observedAttributes(){return["forselect","foridx","foreval"]}attributeChangedCallback(e,t,s){this.params[e]=s}render(context){let select=context[this.params.forselect];if("object"!=typeof select)throw console.warn(`Invalid forSelect="${this.params.forselect}" returned:`,select,"on context",context,"(Element: ",this.outerHTML,")"),"Invalid forSelect selector. see waring.";for(let e=this.elements.length;e<select.length;e++){let e=this.content.cloneNode(!0),t=[];for(let s of e.children)s.ktOwner="for",t.push(s);for(let e=t.length-1;e>=0;e--)this.parentElement.insertBefore(t[e],this.nextSibling);this.elements.unshift({node:t})}for(let idx=0;idx<select.length;idx++){context[this.params.foridx]=idx,context.self=select[idx],null!==this.params.foreval&&eval(this.params.foreval);for(let e of this.elements[idx].node)this.renderRecursive(e,context,!0)}for(let e=this.elements.length;select.length<this.elements.length;e++){let e=this.elements.pop();for(let t of e.node)this.parentElement.removeChild(t)}}}customElements.define("kt-for",KtFor,{extends:"template"});class KtIf extends KtRenderable{constructor(){super(),this.elements=null,this.params={stmt:null}}static get observedAttributes(){return["stmt"]}attributeChangedCallback(e,t,s){this.params[e]=s}render(context){let stmt=this.params.stmt,isTrue=eval(stmt);if(isTrue){if(null!==this.elements){for(let e of this.elements)this.renderRecursive(e,context,!0);return}let e=this.content.cloneNode(!0);this.elements=[];for(let t of e.childNodes)t.ktOwner="if",this.elements.push(t);for(let e=this.elements.length-1;e>=0;e--)this.parentElement.insertBefore(this.elements[e],this.nextSibling);for(let e of this.elements)this.renderRecursive(e,context,!0)}else{if(null===this.elements)return;for(let e of this.elements)this.parentElement.removeChild(e);this.elements=null}}}customElements.define("kt-if",KtIf,{extends:"template"});class KtMaintain extends KtRenderable{constructor(){super(),this.elements=null,this.params={stmt:null}}static get observedAttributes(){return["stmt"]}attributeChangedCallback(e,t,s){this.params[e]=s}render(e){if(null===this.elements){let e=this.content.cloneNode(!0);this.elements=[];for(let t of e.childNodes)t.ktOwner="maintain",this.elements.push(t);for(let e=this.elements.length-1;e>=0;e--)this.parentElement.insertBefore(this.elements[e],this.nextSibling)}for(let t of this.elements)if("function"==typeof t.hasAttribute){for(let s in KT_FN)t.hasAttribute(s)&&KT_FN[s](t,t.getAttribute(s),e);this.renderRecursive(t,e,!0)}}}customElements.define("kt-maintain",KtMaintain,{extends:"template"});class KtTpl extends HTMLElement{constructor(){super(),this.elements=[],this.params={stmt:null}}renderRecursive(e,t){if("function"!=typeof e.render){if(!e.hasOwnProperty("ktOwner"))for(let s of e.childNodes)this.renderRecursive(s,t)}else e.render(t)}static get observedAttributes(){return["stmt"]}attributeChangedCallback(e,t,s){this.params[e]=s}render(e){for(let t of this.childNodes)this.renderRecursive(t,e)}}customElements.define("kt-tpl",KtTpl);class KtVal extends HTMLElement{constructor(){super(),this.elements=[],this.params={stmt:null}}static get observedAttributes(){return["stmt"]}attributeChangedCallback(e,t,s){this.params[e]=s}render(context){this.innerText=JSON.stringify(eval(this.params.stmt))}}customElements.define("kt-val",KtVal);class KtTemplateParser{parseRecursive(e){if("function"!=typeof e.getAttribute)return;if(console.log("parse",e.outerHTML),e.hasAttribute("*for")){let t=document.createElement("template",{is:"kt-for"}),s=e.getAttribute("*for"),l=e.cloneNode(!0);t.content.appendChild(l),t.setAttribute("forselect",s),e.replaceWith(t),e=l}if(e.hasAttribute("*if")){let t=document.createElement("template",{is:"kt-if"}),s=e.getAttribute("*if"),l=e.cloneNode(!0);t.content.appendChild(l),t.setAttribute("stmt",s),e.replaceWith(t),e=l}let t=[],s=[],l=new RegExp("^\\[(.+)\\]$");for(let n of e.getAttributeNames()){console.log("checking",n);let r=l.exec(n);if(null===r)continue;console.log("FOUNT");let i=r[1].split(".");console.log("found",i),1===i.length?s.push(`'${i[0]}': `+e.getAttribute(n)):"classlist"===i[0]&&t.push(`'${i[1]}': `+e.getAttribute(n))}if(console.log(t),s.length>0||t.length>0){let l=document.createElement("template",{is:"kt-maintain"}),n=e.cloneNode(!0);l.content.appendChild(n),s.length>0&&n.setAttribute("kt-attrs","{"+s.join(",")+"}"),t.length>0&&n.setAttribute("kt-classes","{"+t.join(",")+"}"),e.replaceWith(l),e=n}for(let t of e.children)this.parseRecursive(t)}}