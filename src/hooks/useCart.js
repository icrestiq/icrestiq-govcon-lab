import { useState, useCallback } from 'react'

export function useCart() {
  const [cart, setCart] = useState([])

  const addToCart = useCallback((product) => {
    setCart(prev => {
      if (prev.find(p => p.id === product.id)) return prev
      return [...prev, { ...product, qty: 1 }]
    })
  }, [])

  const removeFromCart = useCallback((productId) => {
    setCart(prev => prev.filter(p => p.id !== productId))
  }, [])

  const clearCart = useCallback(() => setCart([]), [])

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0)
  const cartCount = cart.length

  return { cart, addToCart, removeFromCart, clearCart, cartTotal, cartCount }
}
