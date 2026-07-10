import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { createCheckoutSession } from '../lib/stripe'
import { Check, Zap, Crown, Star, Tag } from 'lucide-react'
import styles from './Membership.module.css'

const TIERS = [
  {
    id: null,
    productId: null,
    name: 'Free',
    price: '$0',
    period: 'forever',
    icon: Star,
    iconColor: '#C9A84C', iconBg: '#FFFFF0',
    badge: null,
    description: 'Get started with the foundation.',
    features: [
      'GovCon Mastery Foundation Course (23 lessons)',
      'Public community feed — read only',
      'Sample playbook chapter',
      'Weekly GovCon intel email',
      'Access to merch store',
    ],
    cta: 'Get Started Free',
    ctaLink: '/register',
    disabled: false,
  },
  {
    id: 'lab-monthly',
    productId: 'lab-monthly',
    name: 'Lab Member',
    price: '$57',
    period: '/month',
    icon: Zap,
    iconColor: '#4F6BED', iconBg: '#EBF4FF',
    badge: 'Most Popular',
    badgeType: 'navy',
    badgeColor: '#1B2A4A', badgeBg: '#E8ECF5',
    description: 'Full
