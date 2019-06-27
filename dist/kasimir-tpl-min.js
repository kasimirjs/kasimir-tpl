/**
 * Infracamp's Kasimir Templates
 *
 * A no-dependency render on request
 *
 * @author Matthias Leuffen <m@tth.es>
 */
function kasimir_tpl(e){let t=null;if("string"==typeof e){if(null===(t=document.querySelector(e)))throw"kasimir_tpl(): can't find element '"+e+"'"}else{if(!(e instanceof HTMLElement))throw"kasimir_tpl(): parameter1 is not a HtmlElement";t=e}return(new KasimirRenderer).render(t)}class KasimirRenderer{constructor(e="*"){this._attrPrefix=e}_getAttributeStr(e){let t="";for(let n of e.attributes)t+=" "+n.name+'="'+n.value+'"';return t}_addslashes(e){return e.replace(/\\/g,"\\\\").replace(/\u0008/g,"\\b").replace(/\t/g,"\\t").replace(/\n/g,"\\n").replace(/\f/g,"\\f").replace(/\r/g,"\\r").replace(/'/g,"\\'").replace(/"/g,'\\"')}_getLogic(e){let t={open:"",close:"",handler:{}};e.hasAttribute(this._attrPrefix+"if")&&(t.open+="if("+e.getAttribute(this._attrPrefix+"if")+"){",t.close+="}"),e.hasAttribute(this._attrPrefix+"for")&&(t.open+="for("+e.getAttribute(this._attrPrefix+"for")+"){",t.close+="}");for(let n of e.attributes){null!==n.name.match(/^on(.+)/)&&(t.handler[n.name]=n.value)}return t}_render(e,t,n){let r="";if(e instanceof HTMLElement){let i=this._getLogic(e),l=this._getAttributeStr(e),s=t+" > "+e.tagName+l;if(r+="\n"+i.open,r+="\n__debug_path__ = '"+this._addslashes(s)+"';","SCRIPT"===e.tagName)r+="\neval(`"+e.textContent+"`);";else{r+="\n_e["+n+"] = document.createElement('"+e.tagName+"');";for(let t of e.attributes)t.name.startsWith(this._attrPrefix)||(r+="\n_e["+n+"].setAttribute('"+t.name+"', `"+t.value+"`);");for(let e in i.handler)r+="\n_e["+n+"]."+e+" = function(e){ "+i.handler[e]+" };";r+="\n_e["+(n-1)+"].appendChild(_e["+n+"]);";for(let t of e.childNodes)r+=this._render(t,s,n+1)}r+="\n"+i.close}else if(e instanceof Text){let i=t+" > (text)";r+="\n__debug_path__ = '"+this._addslashes(i)+"';",r+="\n_e["+(n-1)+"].appendChild(document.createTextNode(`"+e.textContent+"`));"}return r}render(domnode){let out="var __debug_path__ = '(root)';";if(out+="\nvar _e = [document.createElement('div')];",domnode instanceof HTMLTemplateElement)for(let e of domnode.content.childNodes)out+=this._render(e,"(root)",1);else out+=this._render(domnode,"(root)",1);let xout=`\n            fn = function(scope){\n                let fns = [];\n                try {\n                    ${out}\n                } catch (e) {\n                    throw 'Error in ' + __debug_path__ + ': ' + e;\n                }\n                return _e[0];\n            };\n        `,fn;return console.log(xout),eval(xout),new KasimirTemplate(fn)}}class KasimirTemplate{constructor(e){this._tplFn=e,this._bind=null}renderIn(e){let t=null;if("string"==typeof e){if(null===(t=document.querySelector(e)))throw"bind(): can't find element '"+e+"'"}else{if(!(e instanceof HTMLElement))throw"bind(): parameter1 is not a HtmlElement";t=e}return this._bind=t,this}render(e){return console.log(this._tplFn(e)),this._bind.replaceChild(this._tplFn(e),this._bind.firstChild),this}observe(e){return this.render(e),window.setInterval(t=>{JSON.stringify(e)!==this._observedLastValue&&(this._observedLastValue=JSON.stringify(e),this.render(e))},200),this}}class KmTplElem extends HTMLElement{constructor(){super(),this._attrs={bind:null,observe:null},this._config={},this.tpl=null}static get observedAttributes(){return["bind","observe"]}attributeChangedCallback(e,t,n){this._attrs[e]=n}connectedCallback(){window.addEventListener("load",()=>{console.log("load",window.data);let e=this.querySelector("template");if(null===e)throw console.error("<km-tpl> has no template child.",this),"<km-tpl> requires <template> child.";if(this.tpl=kasimir_tpl(e),this.removeChild(e),this.tpl.renderIn(this),null!==this._attrs.bind&&this.tpl.bind(window[this._attrs.bind]),this._attrs.observe){let e=window[this._attrs.observe];if(console.log(e),"object"!=typeof e)throw"observed variable window['"+this._attrs.observe+"'] is typeof "+typeof e+" but object required";this.tpl.observe(e)}})}disconnectCallback(){}}customElements.define("km-tpl",KmTplElem);