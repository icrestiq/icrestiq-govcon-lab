w-full" style={{ justifyContent: 'center', fontSize: '1rem', padding: '14px' }}>
              <ShoppingCart size={18} />
              Add to Cart — ${product.price}
            </button>
          )}

          {product.price === 0 && (
            <button className="btn btn-primary w-full" style={{ justifyContent: 'center', fontSize: '1rem', padding: '14px' }}>
              Access Free →
            </button>
          )}

          <p className={styles.note}>
            Secure checkout. Instant digital delivery upon payment confirmation.
          </p>
        </div>
      </div>
    </div>
  )
}