import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Client, Employee, ErpData, Product, Store } from '../types'
import { emptyStore } from '../types'

const STORAGE_KEY = 'erp-gerencial-v1'

const defaultData: ErpData = {
  store: emptyStore(),
  employees: [],
  products: [],
  clients: [],
  isStoreRegistered: false,
}

function loadData(): ErpData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultData
    const parsed = JSON.parse(raw) as Partial<ErpData>
    return {
      ...defaultData,
      ...parsed,
      store: { ...emptyStore(), ...parsed.store },
      products: (parsed.products ?? []).map((p) => ({ ...p, sku: p.sku ?? '' })),
      clients: (parsed.clients ?? []).map((c) => ({ ...c, cpf: c.cpf ?? '' })),
    }
  } catch {
    return defaultData
  }
}

function saveData(data: ErpData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

type ErpContextValue = {
  store: Store
  employees: Employee[]
  products: Product[]
  clients: Client[]
  isStoreRegistered: boolean
  currentUser: Employee | null
  login: (email: string, password: string) => boolean
  logout: () => void
  registerStore: (store: Store, admin: Omit<Employee, 'id' | 'role'>) => void
  addEmployee: (employee: Omit<Employee, 'id'>) => void
  addProduct: (product: Omit<Product, 'id'>) => void
  updateProduct: (id: number, field: keyof Product, value: string | number) => void
  deleteProduct: (id: number) => void
  addClient: (client: Omit<Client, 'id'>) => void
  updateClient: (id: number, field: keyof Client, value: string) => void
  deleteClient: (id: number) => void
}

const ErpContext = createContext<ErpContextValue | null>(null)

export function ErpProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ErpData>(loadData)
  const [currentUser, setCurrentUser] = useState<Employee | null>(null)

  useEffect(() => {
    saveData(data)
  }, [data])

  const login = (email: string, password: string) => {
    const found = data.employees.find(
      (e) => e.email.toLowerCase() === email.toLowerCase() && e.password === password,
    )
    if (found) {
      setCurrentUser(found)
      return true
    }
    return false
  }

  const logout = () => setCurrentUser(null)

  const registerStore = (store: Store, admin: Omit<Employee, 'id' | 'role'>) => {
    const adminEmployee: Employee = { ...admin, id: Date.now(), role: 'admin' }
    setData({
      store,
      employees: [adminEmployee],
      products: [],
      clients: [],
      isStoreRegistered: true,
    })
  }

  const addEmployee = (employee: Omit<Employee, 'id'>) => {
    setData((prev) => ({
      ...prev,
      employees: [...prev.employees, { ...employee, id: Date.now() }],
    }))
  }

  const addProduct = (product: Omit<Product, 'id'>) => {
    setData((prev) => ({
      ...prev,
      products: [...prev.products, { ...product, id: Date.now() }],
    }))
  }

  const updateProduct = (id: number, field: keyof Product, value: string | number) => {
    setData((prev) => ({
      ...prev,
      products: prev.products.map((p) =>
        p.id === id
          ? { ...p, [field]: field === 'price' || field === 'stock' ? Number(value) : value }
          : p,
      ),
    }))
  }

  const deleteProduct = (id: number) => {
    setData((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.id !== id),
    }))
  }

  const addClient = (client: Omit<Client, 'id'>) => {
    setData((prev) => ({
      ...prev,
      clients: [...prev.clients, { ...client, id: Date.now() }],
    }))
  }

  const updateClient = (id: number, field: keyof Client, value: string) => {
    setData((prev) => ({
      ...prev,
      clients: prev.clients.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    }))
  }

  const deleteClient = (id: number) => {
    setData((prev) => ({
      ...prev,
      clients: prev.clients.filter((c) => c.id !== id),
    }))
  }

  return (
    <ErpContext.Provider
      value={{
        store: data.store,
        employees: data.employees,
        products: data.products,
        clients: data.clients,
        isStoreRegistered: data.isStoreRegistered,
        currentUser,
        login,
        logout,
        registerStore,
        addEmployee,
        addProduct,
        updateProduct,
        deleteProduct,
        addClient,
        updateClient,
        deleteClient,
      }}
    >
      {children}
    </ErpContext.Provider>
  )
}

export function useErp() {
  const ctx = useContext(ErpContext)
  if (!ctx) throw new Error('useErp deve ser usado dentro de ErpProvider')
  return ctx
}
