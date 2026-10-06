export type Role = 'admin' | 'user'

export type Store = {
  name: string
  cnpj: string
  phone: string
  email: string
  password: string
  address: string
  city: string
  state: string
  zipCode: string
  tradeName: string
}

export type Employee = {
  id: number
  name: string
  email: string
  password: string
  phone: string
  birthDate: string
  role: Role
}

export type Product = {
  id: number
  name: string
  category: string
  price: number
  stock: number
  sku: string
}

export type Client = {
  id: number
  name: string
  email: string
  phone: string
  city: string
  cpf: string
}

export type ErpData = {
  store: Store
  employees: Employee[]
  products: Product[]
  clients: Client[]
  isStoreRegistered: boolean
}

export type ActiveModule =
  | 'overview'
  | 'employee'
  | 'product'
  | 'manage-products'
  | 'client'
  | 'clients'
  | 'finance'

export const emptyStore = (): Store => ({
  name: '',
  cnpj: '',
  phone: '',
  email: '',
  password: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  tradeName: '',
})
