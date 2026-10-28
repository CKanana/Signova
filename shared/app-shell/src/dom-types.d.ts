/// <reference lib="dom" />

/* ============================================================
   DOM ambient declarations for the shared app-shell
   (the server compiles shared files with lib: ["ES2022"]).
   ============================================================ */

// Core DOM globals
interface Window {
  matchMedia(query: string): MediaQueryList;
  localStorage: Storage;
  sessionStorage: Storage;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

interface MediaQueryList {
  matches: boolean;
  addEventListener(type: "change", listener: (e: MediaQueryListEvent) => void, options?: boolean | AddEventListenerOptions): void;
  removeEventListener(type: "change", listener: (e: MediaQueryListEvent) => void, options?: boolean | EventListenerOptions): void;
  addListener?(listener: (e: MediaQueryListEvent) => void): void;
  removeListener?(listener: (e: MediaQueryListEvent) => void): void;
  onchange: (e: MediaQueryListEvent) => void;
}

interface MediaQueryListEvent extends Event {
  matches: boolean;
  media: string;
}

interface Document {
  documentElement: HTMLElement;
  defaultView: Window | null;
}

interface HTMLElement {
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
}

// Storage
interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
  key(index: number): string | null;
  length: number;
}

// EventListener type
type EventListenerOrEventListenerObject = ((this: EventTarget, ev: Event) => any) | EventListenerObject;

interface EventListenerObject {
  handleEvent(ev: Event): any;
}

// EventTarget
interface EventTarget {
  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void;
  dispatchEvent(event: Event): boolean;
}

// Event
interface Event {
  readonly type: string;
  readonly target: EventTarget | null;
  readonly currentTarget: EventTarget | null;
  readonly eventPhase: number;
  readonly bubbles: boolean;
  readonly cancelable: boolean;
  readonly defaultPrevented: boolean;
  readonly composed: boolean;
  readonly isTrusted: boolean;
  readonly timeStamp: DOMHighResTimeStamp;
  readonly srcElement: EventTarget | null;

  stopPropagation(): void;
  stopImmediatePropagation(): void;
  preventDefault(): void;
  composedPath(): EventTarget[];
  initEvent(type: string, bubbles?: boolean, cancelable?: boolean): void;
}

// KeyboardEvent (for the Drawer Escape handler)
interface KeyboardEvent extends UIEvent {
  readonly key: string;
  readonly code: string;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly repeat: boolean;
  readonly locale: string;
  readonly charCode: number;
  readonly keyCode: number;
  readonly which: number;
  readonly readonlyModifiers: boolean;

  getModifierState(key: string): boolean;
  initKeyboardEvent(
    type: string,
    bubbles?: boolean,
    cancelable?: boolean,
    view?: Window,
    key?: string,
    location?: number,
    ctrlKey?: boolean,
    altKey?: boolean,
    shiftKey?: boolean,
    metaKey?: boolean
  ): void;
}

// Node
interface Node {
  readonly nodeType: number;
  readonly nodeName: string;
  readonly baseURI: string;
  readonly isConnected: boolean;
  readonly parentNode: ParentNode | null;
  readonly parentElement: Element | null;
  readonly childNodes: NodeList;
  readonly firstChild: Node | null;
  readonly lastChild: Node | null;
  readonly previousSibling: Node | null;
  readonly nextSibling: Node | null;
  readonly textContent: string | null;

  appendChild(node: Node): Node;
  removeChild(oldChild: Node): Node;
  replaceChild(newChild: Node, oldChild: Node): Node;
  hasChildNodes(): boolean;
  cloneNode(deep?: boolean): Node;
  normalize(): void;
  isSameNode(otherNode: Node): boolean;
  compareDocumentPosition(other: Node): number;
  contains(other: Node): boolean;
}

// Element
interface Element extends Node {
  readonly attributes: NamedNodeMap;
  readonly classList: DOMTokenList;
  readonly className: string;
  readonly id: string;
  readonly innerHTML: string;
  readonly outerHTML: string;
  readonly shadowRoot: ShadowRoot | null;
  readonly shadowRootMode: string;
  readonly shadowRootBeenClosed: boolean;

  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  removeAttribute(name: string): void;
  getAttributeNames(): string[];
  querySelector(selectors: string): Element | null;
  querySelectorAll(selectors: string): NodeListOf<Element>;
  getElementsByTagName(tagName: string): HTMLCollectionOf<Element>;
  getElementsByClassName(className: string): HTMLCollectionOf<Element>;
  closest(selectors: string): Element | null;
  matches(selectors: string): boolean;
  insertAdjacentElement(position: InsertPosition, element: Element): Element | null;
  insertAdjacentText(position: InsertPosition, data: string): void;
  insertAdjacentHTML(position: InsertPosition, text: string): void;
}

interface HTMLCollectionOf<T> {
  readonly length: number;
  item(index: number): T | null;
  [index: number]: T;
}

// NodeList
interface NodeListOf<TNode extends Node> {
  readonly length: number;
  item(index: number): TNode | null;
  [index: number]: TNode;
  forEach(callback: (node: TNode, index: number, list: NodeListOf<TNode>) => void, thisArg?: any): void;
}

// DOMTokenList
interface DOMTokenList {
  length: number;
  item(index: number): string | null;
  contains(token: string): boolean;
  add(...tokens: string[]): void;
  remove(...tokens: string[]): void;
  toggle(token: string, force?: boolean): boolean;
  replace(oldToken: string, newToken: string): boolean;
  toString(): string;
}

// AddEventListenerOptions
interface AddEventListenerOptions {
  capture?: boolean;
  once?: boolean;
  passive?: boolean;
  signal?: AbortSignal;
}

interface EventListenerOptions {
  capture?: boolean;
}

// InsertPosition
type InsertPosition = "beforebegin" | "afterbegin" | "beforeend" | "afterend";

// DOMHighResTimeStamp
type DOMHighResTimeStamp = number;

// AbortSignal
interface AbortSignal {
  aborted: boolean;
  addEventListener(type: "abort", listener: ((event: Event) => any) | null, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: "abort", listener: ((event: Event) => any) | null, options?: boolean | EventListenerOptions): void;
  throwIfAborted(): void;
}

// URL
interface URL {
  href: string;
  origin: string;
  protocol: string;
  username: string;
  password: string;
  host: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
  readonly searchParams: URLSearchParams;
  toString(): string;
  toJSON(): string;
}

interface URLSearchParams {
  readonly size: number;
  append(name: string, value: string): void;
  delete(name: string): void;
  get(name: string): string | null;
  getAll(name: string): string[];
  has(name: string): boolean;
  set(name: string, value: string): void;
  sort(): void;
  entries(): IterableIterator<[string, string]>;
  keys(): IterableIterator<string>;
  values(): IterableIterator<string>;
  forEach(callback: (value: string, key: string, parent: URLSearchParams) => void, thisArg?: any): void;
}
