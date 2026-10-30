import { createContext, useContext } from 'react'
import { ToastContainer, toast as reactToastifyToast, Slide } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const toast = {
    success: (message, options = {}) =>
      reactToastifyToast.success(message, {
        position: 'top-center',
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: 'colored',
        transition: Slide,
        ...options,
      }),
    error: (message, options = {}) =>
      reactToastifyToast.error(message, {
        position: 'top-center',
        autoClose: 4000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: 'colored',
        transition: Slide,
        ...options,
      }),
    info: (message, options = {}) =>
      reactToastifyToast.info(message, {
        position: 'top-center',
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: 'colored',
        transition: Slide,
        ...options,
      }),
    warning: (message, options = {}) =>
      reactToastifyToast.warning(message, {
        position: 'top-center',
        autoClose: 3500,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: 'colored',
        transition: Slide,
        ...options,
      }),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer
        position="top-center"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
        transition={Slide}
        toastClassName="!rounded-xl !font-semibold !text-sm !shadow-xl"
      />
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
