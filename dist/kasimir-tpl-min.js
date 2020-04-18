/**
 * Infracamp's Kasimir Templates
 *
 * A no-dependency render on request
 *
 * @author Matthias Leuffen <m@tth.es>
 */
class KtHelper{keval(stmt,c,e){try{let $=c;return eval(stmt)}catch(t){throw console.warn("cannot eval() stmt: '"+stmt+"' on element ",e.outerHTML,"(context:",c,")"),"eval('"+stmt+"') failed: "+t}}scopeEval($scope,selector){let r="let $ = $scope;";for(let e in $scope)r+=`var ${e} = $scope['${e}'];`;let __val=null;return r+=`__val = ${selector};`,console.log(r),eval(r),__val}}var _KT_ELEMENT_ID=0;class KtRenderable extends HTMLTemplateElement{constructor(){super(),this._hlpr=new KtHelper,this._els=null,this._attrs={debug:!1},this._ktId=++_KT_ELEMENT_ID}attributeChangedCallback(e,t,s){this._attrs[e]=s}_log(e,t,s){let n=arguments;!1!==this._attrs.debug&&console.log.apply(this,n)}renderRecursive(e,t,s){if(!e.hasOwnProperty("_kaMb")||e._kaMb===this._ktId)if("function"!=typeof e.render)for(let s of e.childNodes){if(!0===e.ktSkipRender)return;this.renderRecursive(s,t)}else e.render(t)}removeNode(){for(let e of this._els)"function"==typeof e.removeNode&&e.removeNode(),null!==this.parentElement&&this.parentElement.removeChild(e)}_appendElementsToParent(e){void 0===e&&(e=this.nextSibling);let t=this.content.cloneNode(!0);this._els=[],this._log(t.children);for(let e of t.children)e._kaMb=this._ktId,this._els.push(e);this.parentElement.insertBefore(t,e)}}class KtTemplateParser{_parseTextNode(e,t){let s=e.split(/(\{\{|\}\})/);for(;s.length>0&&(t.appendChild(new Text(s.shift())),0!==s.length);){s.shift();let e=new KaVal;e.setAttribute("stmt",s.shift().trim()),s.shift(),t.appendChild(e)}}parseRecursive(e){if(e instanceof DocumentFragment){for(let t of e.children)this.parseRecursive(t);return}if("function"!=typeof e.getAttribute)return;if(!0===e.ktParsed)return;e.ktParsed=!0;for(let t of e.childNodes){if(void 0===t.data)continue;let e=new DocumentFragment;this._parseTextNode(t.data,e),t.replaceWith(e)}if(e.hasAttribute("*for")){let t=document.createElement("template",{is:"kt-for"}),s=e.getAttribute("*for"),n=e.cloneNode(!0);t.content.appendChild(n),t.setAttribute("forselect",s),e.replaceWith(t),e=n}if(e.hasAttribute("*if")){let t=document.createElement("template",{is:"kt-if"}),s=e.getAttribute("*if"),n=e.cloneNode(!0);t.content.appendChild(n),t.setAttribute("stmt",s),e.replaceWith(t),e=n}let t=[],s=[],n=new RegExp("^\\[(.+)\\]$");for(let r of e.getAttributeNames()){let i=n.exec(r);if(null===i)continue;let l=i[1].split(".");if(1===l.length)s.push(`'${l[0]}': `+e.getAttribute(r));else switch(l[0]){case"classlist":t.push(`'${l[1]}': `+e.getAttribute(r));break;default:console.warn("Invalid attribute '"+r+"'")}}if(s.length>0||t.length>0){let n=document.createElement("template",{is:"kt-maintain"}),r=e.cloneNode(!0);n.content.appendChild(r),s.length>0&&r.setAttribute("kt-attrs","{"+s.join(",")+"}"),t.length>0&&r.setAttribute("kt-classes","{"+t.join(",")+"}"),e.replaceWith(n),e=r}for(let t of e.children)this.parseRecursive(t)}}function ka_tpl(e){if(e instanceof KaTpl)return e;let t=document.getElementById(e);if(t instanceof KaTpl)return t;throw`Selector '${e}' is not a <template is="ka-tpl"> element`}var KT_FN={"kt-classes":function(e,t,s){"use strict";let n=(new KtHelper).scopeEval(s,t);for(let t in n)n.hasOwnProperty(t)&&(!0===n[t]?e.classList.add(t):e.classList.remove(t))},"kt-attrs":function(e,t,s){let n=(new KtHelper).scopeEval(s,t);for(let t in n)n.hasOwnProperty(t)&&(null!==n[t]?e.setAttribute(t,n[t]):e.setAttribute(t,""))}},KASELF=null;class KaTpl extends KtRenderable{constructor(){super(),this._attrs={debug:!1,stmt:null,afterrender:null},this._isInitializing=!1,this._isRendering=!1,this._scope={}}static get observedAttributes(){return["stmt","debug"]}disconnectedCallback(){for(let e of this._els)this.parentElement.removeChild(e)}connectedCallback(){this.hasAttribute("auto")&&document.addEventListener("DOMContentLoaded",()=>{this._init(),this.render(this._scope)})}set $scope(e){this._scope=e,this._isInitializing||this.render(this._scope)}get $scope(){let e={set:(e,t,s,n)=>(e[t]=s,this._isRendering||this.render(this.$scope),!0),get:(t,s)=>"object"==typeof t[s]?new Proxy(t[s],e):t[s]};return new Proxy(this._scope,e)}_init(){if(null!==this._els)return;this._isInitializing=!0,null!==this.nextElementSibling&&this.nextElementSibling.hasAttribute("ka-loader")&&this.parentElement.removeChild(this.nextElementSibling);this.nextSibling;(new KtTemplateParser).parseRecursive(this.content),KASELF=this,null===this._els&&this._appendElementsToParent(),this._isInitializing=!1}render(e){this._log("render($scope= ",e,")"),this._init(),this._isRendering=!0;for(let t of this._els)this.renderRecursive(t,e,!0);this._isRendering=!1}}customElements.define("ka-tpl",KaTpl,{extends:"template"});class KaVal extends HTMLElement{constructor(){super(),this._ktHlpr=new KtHelper,this._attrs={debug:!1,stmt:null,afterrender:null}}static get observedAttributes(){return["stmt","afterrender","debug"]}attributeChangedCallback(e,t,s){this._attrs[e]=s}connectedCallback(){this.hasAttribute("auto")&&this.render({})}_log(){!1!==this._attrs.debug&&console.log.apply(this,arguments)}render($scope){this._log("render(",$scope,`) on '${this.outerHTML}'`);try{let v=this._ktHlpr.scopeEval($scope,this._attrs.stmt);if(this.hasAttribute("unindent")){let e=v.match(/\n(\s*)/m)[1];v=v.replace(new RegExp(`\n${e}`,"g"),"\n"),v=v.trim()}this.hasAttribute("html")?this.innerHTML=v:this.innerText=v,null!==this._attrs.afterrender&&eval(this._attrs.afterrender)}catch(e){this.innerText=e}}}customElements.define("ka-val",KaVal);class KtFor extends KtRenderable{constructor(){super(),this.elements=[],this.origSibling=!1,this.params={forselect:null,foridx:"idx",foreval:null}}static get observedAttributes(){return["forselect","foridx","foreval"]}attributeChangedCallback(e,t,s){this.params[e]=s}render(e){let t=e[this.params.forselect];if("object"!=typeof t)throw console.warn(`Invalid forSelect="${this.params.forselect}" returned:`,t,"on context",e,"(Element: ",this.outerHTML,")"),"Invalid forSelect selector. see waring.";!1===this.origSibling&&(this.origSibling=this.nextSibling);for(let e=this.elements.length;e<t.length;e++){let e=this.content.cloneNode(!0),t=[];for(let s of e.children)s._kaMb=this._ktId,t.push(s);for(let e=0;e<t.length;e++)this.parentElement.insertBefore(t[e],this.origSibling);this.elements.push({node:t})}for(let s=0;s<t.length;s++){e[this.params.foridx]=s,e.self=t[s],null!==this.params.foreval&&this._hlpr.keval(this.params.foreval,e,this);for(let t of this.elements[s].node)this.renderRecursive(t,e,!0)}for(let e=this.elements.length;t.length<this.elements.length;e++){let e=this.elements.pop();for(let t of e.node)"function"==typeof t.removeNode&&t.removeNode(),this.parentElement.removeChild(t)}}}customElements.define("kt-for",KtFor,{extends:"template"});class KtIf extends KtRenderable{constructor(){super(),this.elements=null,this._attrs={stmt:null}}static get observedAttributes(){return["stmt"]}attributeChangedCallback(e,t,s){this._attrs[e]=s}render(e){this.params.stmt;if(this._hlpr.scopeEval($scope,this._attr.stmt)){if(null!==this.elements){for(let t of this.elements)this.renderRecursive(t,e,!0);return}let t=this.content.cloneNode(!0);this.elements=[];for(let e of t.childNodes)e.ktOwner="if",this.elements.push(e);for(let e=this.elements.length-1;e>=0;e--)this.parentElement.insertBefore(this.elements[e],this.nextSibling);for(let t of this.elements)this.renderRecursive(t,e,!0)}else{if(null===this.elements)return;for(let e of this.elements)this.parentElement.removeChild(e);this.elements=null}}}customElements.define("kt-if",KtIf,{extends:"template"});class KtInclude extends KtRenderable{constructor(){super(),this.elements=null,this.params={src:null}}static get observedAttributes(){return["src"]}attributeChangedCallback(e,t,s){this.params[e]=s}loadRemote(){}_appendChildFromContent(){if(null!==this.elements)return;let e=this.content.cloneNode(!0);this.elements=[];for(let t of e.childNodes)t.ktOwner="include",this.elements.push(t);for(let e=this.elements.length-1;e>=0;e--)this.parentElement.insertBefore(this.elements[e],this.nextSibling)}_renderElements(){for(let e of this.elements)this.renderRecursive(e,context,!0)}loadDataRemote(){let e=new XMLHttpRequest;e.open("GET",this.params.src),e.onreadystatechange=(()=>{if(4===e.readyState){if(e.status>=400)return void console.warn("Can't load '"+this.params.src+"': "+e.responseText);return this.innerHTML=e.responseText,(new KtTemplateParser).parseRecursive(this.content),this._appendChildFromContent(),void this._renderElements()}}),e.send()}render(e){null===this.elements?this.loadDataRemote():this._renderElements()}}customElements.define("kt-include",KtInclude,{extends:"template"});class KtMaintain extends KtRenderable{constructor(){super(),this._attrs={stmt:null,debug:!1}}static get observedAttributes(){return["stmt","debug"]}disconnectedCallback(){this.removeNode()}render(e){null===this._els&&this._appendElementsToParent();for(let t of this._els)if("function"==typeof t.hasAttribute){for(let s in KT_FN)t.hasAttribute(s)&&KT_FN[s](t,t.getAttribute(s),e);this.renderRecursive(t,e,!0)}}}customElements.define("kt-maintain",KtMaintain,{extends:"template"});