import React, { useState, useEffect, useRef } from 'react'
import { Search, User, Phone, MapPin, CheckCircle, X, Trash2 } from 'lucide-react'
import EnhancedAPI from '../../api/enhanced-api'
import { CustomerWithOrders } from '../../types'
import LoadingSpinner from './LoadingSpinner'

interface CustomerSearchInputProps {
  value: string
  onChange: (customerId: string, customer?: CustomerWithOrders) => void
  onBlur?: () => void
  error?: string
  disabled?: boolean
  placeholder?: string
  required?: boolean
  className?: string
}

const CustomerSearchInput: React.FC<CustomerSearchInputProps> = ({
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
  placeholder = "ابحث عن عميل بالاسم أو رقم الهاتف...",
  required = false,
  className = ''
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [customers, setCustomers] = useState<CustomerWithOrders[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithOrders | null>(null)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('customerSearchHistory')
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved))
      } catch (error) {
        console.error('Error loading search history:', error)
      }
    }
  }, [])

  // Save search term to recent searches
  const saveToRecentSearches = (term: string) => {
    if (term.length < 2) return
    
    const updated = [term, ...recentSearches.filter(s => s !== term)].slice(0, 5)
    setRecentSearches(updated)
    localStorage.setItem('customerSearchHistory', JSON.stringify(updated))
  }

  // Find selected customer when value changes
  useEffect(() => {
    if (value && value !== selectedCustomer?.id) {
      // Try to find customer from current list first
      const found = customers.find(c => c.id === value)
      if (found) {
        setSelectedCustomer(found)
        setSearchTerm(found.name)
      } else {
        // Fetch customer details if not in current list
        EnhancedAPI.getCustomerById(value).then(customer => {
          if (customer) {
            setSelectedCustomer(customer)
            setSearchTerm(customer.name)
          }
        }).catch(error => {
          console.error('Error fetching customer:', error)
        })
      }
    } else if (!value && selectedCustomer) {
      setSelectedCustomer(null)
      setSearchTerm('')
    }
  }, [value, customers])

  // Search customers with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (searchTerm.length >= 2) {
      searchTimeoutRef.current = setTimeout(async () => {
        setLoading(true)
        try {
          const results = await EnhancedAPI.searchCustomers(searchTerm, 10)
          setCustomers(results)
          setIsOpen(true)
          setHighlightedIndex(-1)
        } catch (error) {
          console.error('Error searching customers:', error)
          setCustomers([])
        } finally {
          setLoading(false)
        }
      }, 300)
    } else {
      setCustomers([])
      setIsOpen(false)
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchTerm])

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setSearchTerm(newValue)
    
    // Clear selection if user is typing and it's different from selected customer
    if (selectedCustomer && newValue !== selectedCustomer.name) {
      setSelectedCustomer(null)
      onChange('', undefined)
    }
    
    // Show dropdown if there are results and input has focus
    if (newValue.length >= 2 && customers.length > 0) {
      setIsOpen(true)
    }
  }

  const handleCustomerSelect = (customer: CustomerWithOrders) => {
    setSelectedCustomer(customer)
    setSearchTerm(customer.name)
    setIsOpen(false)
    onChange(customer.id, customer)
    
    // Save to recent searches
    saveToRecentSearches(customer.name)
  }

  const handleClear = () => {
    setSelectedCustomer(null)
    setSearchTerm('')
    setIsOpen(false)
    onChange('', undefined)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || customers.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev => 
          prev < customers.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : customers.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && customers[highlightedIndex]) {
          handleCustomerSelect(customers[highlightedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setHighlightedIndex(-1)
        break
    }
  }

  const handleFocus = () => {
    if (searchTerm.length >= 2 && customers.length > 0) {
      setIsOpen(true)
    } else if (searchTerm.length === 0 && recentSearches.length > 0) {
      setIsOpen(true)
    }
  }

  const handleBlur = () => {
    // Delay to allow click on dropdown items
    setTimeout(() => {
      onBlur?.()
    }, 150)
  }

  return (
    <div className={`relative ${className}`}>
      <label className="flex items-center label label-required text-gray-700 font-medium mb-2">
        <User className="h-4 w-4 ml-2 text-primary-500" />
        العميل
        {required && <span className="text-red-500 mr-1">*</span>}
      </label>
      
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            w-full pl-10 pr-10 py-3 border-2 rounded-xl transition-all duration-200
            focus:ring-4 focus:ring-primary-100 focus:border-primary-500
            hover:border-primary-300 bg-white/80 backdrop-blur-sm
            ${error ? 'border-red-500 focus:ring-red-100 focus:border-red-500' : 'border-gray-200'}
            ${selectedCustomer ? 'border-green-500 focus:ring-green-100 focus:border-green-500' : ''}
            ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''}
          `}
        />
        
        {/* Search Icon */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          {loading ? (
            <div className="animate-spin">
              <LoadingSpinner size="small" />
            </div>
          ) : (
            <Search className="h-4 w-4 text-gray-400" />
          )}
        </div>
        
        {/* Status Icon */}
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
          {selectedCustomer ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <User className="h-4 w-4 text-gray-400" />
          )}
        </div>
        
        {/* Clear Button */}
        {selectedCustomer && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute left-10 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-3 w-3 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>
      
      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-600 mt-1 animate-bounce-in flex items-center">
          <X className="h-3 w-3 ml-1" />
          {error}
        </p>
      )}
      
      {/* Selected Customer Info */}
      {selectedCustomer && (
        <div className={`mt-2 p-3 rounded-lg ${
          selectedCustomer.is_active 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                selectedCustomer.is_active 
                  ? 'bg-green-100' 
                  : 'bg-red-100'
              }`}>
                <User className={`h-4 w-4 ${
                  selectedCustomer.is_active 
                    ? 'text-green-600' 
                    : 'text-red-600'
                }`} />
              </div>
              <div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <p className={`font-medium ${
                    selectedCustomer.is_active 
                      ? 'text-green-800' 
                      : 'text-red-800'
                  }`}>{selectedCustomer.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    selectedCustomer.is_active 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {selectedCustomer.is_active ? 'نشط' : 'موقوف'}
                  </span>
                </div>
                <div className={`flex items-center space-x-4 space-x-reverse text-sm ${
                  selectedCustomer.is_active 
                    ? 'text-green-600' 
                    : 'text-red-600'
                }`}>
                  <div className="flex items-center">
                    <Phone className="h-3 w-3 ml-1" />
                    {selectedCustomer.phone}
                  </div>
                  {selectedCustomer.area && (
                    <div className="flex items-center">
                      <MapPin className="h-3 w-3 ml-1" />
                      {selectedCustomer.area}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className={`text-xs px-2 py-1 rounded-full ${
              selectedCustomer.is_active 
                ? 'text-green-600 bg-green-100' 
                : 'text-red-600 bg-red-100'
            }`}>
              {selectedCustomer.total_orders || 0} طلب
            </div>
          </div>
        </div>
      )}
      
      {/* Recent Searches */}
      {isOpen && searchTerm.length === 0 && recentSearches.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-hidden"
        >
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-600 flex items-center">
                <Search className="h-3 w-3 ml-1" />
                عمليات البحث الأخيرة
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setRecentSearches([])
                  localStorage.removeItem('customerSearchHistory')
                }}
                className="p-1 hover:bg-gray-200 rounded-full transition-colors group"
                title="مسح تاريخ البحث"
              >
                <Trash2 className="h-3 w-3 text-gray-400 group-hover:text-red-500" />
              </button>
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {recentSearches.map((term, index) => (
               <div
                 key={index}
                 className="p-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 group"
               >
                 <div className="flex items-center justify-between">
                   <div 
                     onClick={() => {
                       setSearchTerm(term)
                       inputRef.current?.focus()
                     }}
                     className="flex items-center flex-1 cursor-pointer"
                   >
                     <Search className="h-4 w-4 text-gray-400 ml-2" />
                     <span className="text-gray-700">{term}</span>
                   </div>
                   <button
                     onClick={(e) => {
                       e.stopPropagation()
                       const updated = recentSearches.filter((_, i) => i !== index)
                       setRecentSearches(updated)
                       localStorage.setItem('customerSearchHistory', JSON.stringify(updated))
                     }}
                     className="p-1 hover:bg-gray-200 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                     title="إزالة من التاريخ"
                   >
                     <X className="h-3 w-3 text-gray-400 hover:text-red-500" />
                   </button>
                 </div>
               </div>
             ))}
          </div>
        </div>
      )}
      
      {/* Dropdown */}
      {isOpen && customers.length > 0 && searchTerm.length >= 2 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-hidden"
        >
          <div className="max-h-52 overflow-y-auto">
            {customers.map((customer, index) => (
              <div
                key={customer.id}
                onClick={() => handleCustomerSelect(customer)}
                className={`
                  p-3 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0
                  ${index === highlightedIndex ? 'bg-primary-50 border-primary-200' : 'hover:bg-gray-50'}
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      customer.is_active 
                        ? 'bg-green-100' 
                        : 'bg-red-100'
                    }`}>
                      <User className={`h-4 w-4 ${
                        customer.is_active 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`} />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <p className="font-medium text-gray-900">{customer.name}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          customer.is_active 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {customer.is_active ? 'نشط' : 'موقوف'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 space-x-reverse text-sm text-gray-500">
                        <div className="flex items-center">
                          <Phone className="h-3 w-3 ml-1" />
                          {customer.phone}
                        </div>
                        {customer.area && (
                          <div className="flex items-center">
                            <MapPin className="h-3 w-3 ml-1" />
                            {customer.area}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded-full ${
                    customer.is_active 
                      ? 'text-green-600 bg-green-100' 
                      : 'text-red-600 bg-red-100'
                  }`}>
                    {customer.total_orders || 0} طلب
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Keyboard shortcuts hint */}
          <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between">
            <div className="flex items-center space-x-4 space-x-reverse">
              <span className="flex items-center">
                <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-xs ml-1">↑↓</kbd>
                للتنقل
              </span>
              <span className="flex items-center">
                <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-xs ml-1">Enter</kbd>
                للاختيار
              </span>
            </div>
            <span className="flex items-center">
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-xs ml-1">Esc</kbd>
              للإغلاق
            </span>
          </div>
        </div>
      )}
      
      {/* No Results */}
      {isOpen && !loading && searchTerm.length >= 2 && customers.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl p-4 text-center">
          <div className="text-gray-500">
            <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">لا توجد نتائج للبحث "{searchTerm}"</p>
            <p className="text-xs text-gray-400 mt-1">جرب البحث بكلمات مختلفة أو تأكد من صحة البيانات</p>
          </div>
        </div>
      )}
      
      {/* Search Hint */}
      {!isOpen && !selectedCustomer && searchTerm.length > 0 && searchTerm.length < 2 && (
        <div className="absolute z-50 w-full mt-1 bg-blue-50 border border-blue-200 rounded-xl shadow-lg p-3 text-center">
          <div className="text-blue-600">
            <Search className="h-6 w-6 mx-auto mb-1 text-blue-400" />
            <p className="text-xs">اكتب حرفين على الأقل للبحث</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomerSearchInput