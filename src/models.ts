export type TItem = {
  id: number;
  name: string;
  value: number;
}

export type TCart = TCartItem[];

export type TCartItem = {
  item: TItem,
  quantity: number;
}