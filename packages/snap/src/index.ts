import type { OnRpcRequestHandler } from '@metamask/snaps-types';
import { panel, text } from '@metamask/snaps-ui';

import { schnorr } from '@noble/curves/secp256k1'
import { bytesToHex } from '@noble/hashes/utils'
import { sha256 } from '@noble/hashes/sha256'

export function generatePrivateKey(): string {
  return bytesToHex(schnorr.utils.randomPrivateKey())
}

export function getPublicKey(privateKey: string): string {
  return bytesToHex(schnorr.getPublicKey(privateKey))
}

async function getFees() {
  const response = await fetch('https://beaconcha.in/api/v1/execution/gasnow');
  return response.text();
}


export const verifiedSymbol = Symbol('verified')


export enum Kind {
  Metadata = 0,
  Text = 1,
  RecommendRelay = 2,
  Contacts = 3,
  EncryptedDirectMessage = 4,
  EventDeletion = 5,
  Repost = 6,
  Reaction = 7,
  BadgeAward = 8,
  ChannelCreation = 40,
  ChannelMetadata = 41,
  ChannelMessage = 42,
  ChannelHideMessage = 43,
  ChannelMuteUser = 44,
  Blank = 255,
  Report = 1984,
  ZapRequest = 9734,
  Zap = 9735,
  RelayList = 10002,
  ClientAuth = 22242,
  NwcRequest = 23194,
  HttpAuth = 27235,
  ProfileBadge = 30008,
  BadgeDefinition = 30009,
  Article = 30023,
  FileMetadata = 1063,
}


export interface Event<K extends number = number> {
  kind: K
  tags: string[][]
  content: string
  created_at: number
  pubkey: string
  id: string
  sig: string
  [verifiedSymbol]?: boolean
}

export const utf8Decoder = new TextDecoder('utf-8')
export const utf8Encoder = new TextEncoder()

export function normalizeURL(url: string): string {
  let p = new URL(url)
  p.pathname = p.pathname.replace(/\/+/g, '/')
  if (p.pathname.endsWith('/')) p.pathname = p.pathname.slice(0, -1)
  if ((p.port === '80' && p.protocol === 'ws:') || (p.port === '443' && p.protocol === 'wss:')) p.port = ''
  p.searchParams.sort()
  p.hash = ''
  return p.toString()
}

//
// fast insert-into-sorted-array functions adapted from https://github.com/terrymorse58/fast-sorted-array
//
export function insertEventIntoDescendingList(sortedArray: Event<number>[], event: Event<number>) {
  let start = 0
  let end = sortedArray.length - 1
  let midPoint
  let position = start

  if (end < 0) {
    position = 0
  } else if (event.created_at < sortedArray[end].created_at) {
    position = end + 1
  } else if (event.created_at >= sortedArray[start].created_at) {
    position = start
  } else
    while (true) {
      if (end <= start + 1) {
        position = end
        break
      }
      midPoint = Math.floor(start + (end - start) / 2)
      if (sortedArray[midPoint].created_at > event.created_at) {
        start = midPoint
      } else if (sortedArray[midPoint].created_at < event.created_at) {
        end = midPoint
      } else {
        // aMidPoint === num
        position = midPoint
        break
      }
    }

  // insert when num is NOT already in (no duplicates)
  if (sortedArray[position]?.id !== event.id) {
    return [...sortedArray.slice(0, position), event, ...sortedArray.slice(position)]
  }

  return sortedArray
}

export function insertEventIntoAscendingList(sortedArray: Event<number>[], event: Event<number>) {
  let start = 0
  let end = sortedArray.length - 1
  let midPoint
  let position = start

  if (end < 0) {
    position = 0
  } else if (event.created_at > sortedArray[end].created_at) {
    position = end + 1
  } else if (event.created_at <= sortedArray[start].created_at) {
    position = start
  } else
    while (true) {
      if (end <= start + 1) {
        position = end
        break
      }
      midPoint = Math.floor(start + (end - start) / 2)
      if (sortedArray[midPoint].created_at < event.created_at) {
        start = midPoint
      } else if (sortedArray[midPoint].created_at > event.created_at) {
        end = midPoint
      } else {
        // aMidPoint === num
        position = midPoint
        break
      }
    }

  // insert when num is NOT already in (no duplicates)
  if (sortedArray[position]?.id !== event.id) {
    return [...sortedArray.slice(0, position), event, ...sortedArray.slice(position)]
  }

  return sortedArray
}

export class MessageNode {
  private _value: string
  private _next: MessageNode | null

  public get value(): string {
    return this._value
  }
  public set value(message: string) {
    this._value = message
  }
  public get next(): MessageNode | null {
    return this._next
  }
  public set next(node: MessageNode | null) {
    this._next = node
  }

  constructor(message: string) {
    this._value = message
    this._next = null
  }
}

export class MessageQueue {
  private _first: MessageNode | null
  private _last: MessageNode | null

  public get first(): MessageNode | null {
    return this._first
  }
  public set first(messageNode: MessageNode | null) {
    this._first = messageNode
  }
  public get last(): MessageNode | null {
    return this._last
  }
  public set last(messageNode: MessageNode | null) {
    this._last = messageNode
  }
  private _size: number
  public get size(): number {
    return this._size
  }
  public set size(v: number) {
    this._size = v
  }

  constructor() {
    this._first = null
    this._last = null
    this._size = 0
  }
  enqueue(message: string): boolean {
    const newNode = new MessageNode(message)
    if (this._size === 0 || !this._last) {
      this._first = newNode
      this._last = newNode
    } else {
      this._last.next = newNode
      this._last = newNode
    }
    this._size++
    return true
  }
  dequeue(): string | null {
    if (this._size === 0 || !this._first) return null

    let prev = this._first
    this._first = prev.next
    prev.next = null

    this._size--
    return prev.value
  }
}


export type EventTemplate<K extends number = number> = Pick<Event<K>, 'kind' | 'tags' | 'content' | 'created_at'>
export type UnsignedEvent<K extends number = number> = Pick<
  Event<K>,
  'kind' | 'tags' | 'content' | 'created_at' | 'pubkey'
>

/** An event whose signature has been verified. */
export interface VerifiedEvent<K extends number = number> extends Event<K> {
  [verifiedSymbol]: true
}

export function getBlankEvent(): EventTemplate<Kind.Blank>
export function getBlankEvent<K extends number>(kind: K): EventTemplate<K>
export function getBlankEvent<K>(kind: K | Kind.Blank = Kind.Blank) {
  return {
    kind,
    content: '',
    tags: [],
    created_at: 0,
  }
}

export function finishEvent<K extends number = number>(t: EventTemplate<K>, privateKey: string): VerifiedEvent<K> {
  const event = t as VerifiedEvent<K>
  event.pubkey = getPublicKey(privateKey)
  event.id = getEventHash(event)
  event.sig = getSignature(event, privateKey)
  event[verifiedSymbol] = true
  return event
}

export function serializeEvent(evt: UnsignedEvent<number>): string {
  if (!validateEvent(evt)) throw new Error("can't serialize event with wrong or missing properties")

  return JSON.stringify([0, evt.pubkey, evt.created_at, evt.kind, evt.tags, evt.content])
}

export function getEventHash(event: UnsignedEvent<number>): string {
  let eventHash = sha256(utf8Encoder.encode(serializeEvent(event)))
  return bytesToHex(eventHash)
}

const isRecord = (obj: unknown): obj is Record<string, unknown> => obj instanceof Object

export function validateEvent<T>(event: T): event is T & UnsignedEvent<number> {
  if (!isRecord(event)) return false
  if (typeof event.kind !== 'number') return false
  if (typeof event.content !== 'string') return false
  if (typeof event.created_at !== 'number') return false
  if (typeof event.pubkey !== 'string') return false
  if (!event.pubkey.match(/^[a-f0-9]{64}$/)) return false

  if (!Array.isArray(event.tags)) return false
  for (let i = 0; i < event.tags.length; i++) {
    let tag = event.tags[i]
    if (!Array.isArray(tag)) return false
    for (let j = 0; j < tag.length; j++) {
      if (typeof tag[j] === 'object') return false
    }
  }

  return true
}

/** Verify the event's signature. This function mutates the event with a `verified` symbol, making it idempotent. */
export function verifySignature<K extends number>(event: Event<K>): event is VerifiedEvent<K> {
  if (typeof event[verifiedSymbol] === 'boolean') return event[verifiedSymbol]

  const hash = getEventHash(event)
  if (hash !== event.id) {
    return (event[verifiedSymbol] = false)
  }

  try {
    return (event[verifiedSymbol] = schnorr.verify(event.sig, hash, event.pubkey))
  } catch (err) {
    return (event[verifiedSymbol] = false)
  }
}

/** @deprecated Use `getSignature` instead. */
export function signEvent(event: UnsignedEvent<number>, key: string): string {
  console.warn(
    'nostr-tools: `signEvent` is deprecated and will be removed or changed in the future. Please use `getSignature` instead.',
  )
  return getSignature(event, key)
}

/** Calculate the signature for an event. */
export function getSignature(event: UnsignedEvent<number>, key: string): string {
  return bytesToHex(schnorr.sign(getEventHash(event), key))
}






/**
 * Handle incoming JSON-RPC requests, sent through `wallet_invokeSnap`.
 *
 * @param args - The request handler args as object.
 * @param args.origin - The origin of the request, e.g., the website that
 * invoked the snap.
 * @param args.request - A validated JSON-RPC request object.
 * @returns The result of `snap_dialog`.
 * @throws If the request method is not valid for this snap.
 */
export const onRpcRequest: OnRpcRequestHandler = async ({ origin, request }) => {
  let entropy: any
  let event: any
  switch (request.method) {
    case 'genRandomKey':
      return snap.request({
        method: 'snap_dialog',
        params: {
            type: 'alert',
            content: panel([
              text(`Hello, **${origin}**!`),
              text(`Current gas fee estimates: ${generatePrivateKey()} `),
            ]),
        },
      });
    case 'getKey':
      entropy = await snap.request({
        method: 'snap_getEntropy',
        params: {
          version: 1,
        },
      });
      snap.request({
        method: 'snap_dialog',
        params: {
            type: 'alert',
            content: panel([
              text(`Hello, **${origin}**!`),
              text(`Current gas fee estimates: ${entropy} `),
            ]),
        },
      });
      return entropy
    case 'echo':
      entropy = await snap.request({
        method: 'snap_getEntropy',
        params: {
          version: 1,
        },
      });
      let prvkey = entropy.slice(2)
      let pubkey = getPublicKey(prvkey)
      event = request.params
      event.id = getEventHash(event)
      event.sig = getSignature(event, prvkey)
      return event
    case 'hello':
      entropy = await snap.request({
        method: 'snap_getEntropy',
        params: {
          version: 1,
        },
      });
      snap.request({
        method: 'snap_dialog',
        params: {
            type: 'alert',
            content: panel([
              text(`Hello, **${origin}**!`),
              text(`Current gas fee estimates: ${entropy} `),
            ]),
        },
      });
      // getSignature()
      return entropy
    default:
      throw new Error('Method not found.');
  }
};
