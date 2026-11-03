import { createContext, useContext } from 'react'
import { ToastContainer, toast as reactToastifyToast, Slide } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const toast = {
    success: (message, options = {}) =>
      reactToastifyToast.success(message, {
        position: 'top-center',
        autoClose: 1500,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: false,
        theme: 'colored',
        transition: Slide,
        ...options,
      }),
    error: (message, options = {}) =>
      reactToastifyToast.error(message, {
        position: 'top-center',
        autoClose: 2500,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: false,
        theme: 'colored',
        transition: Slide,
        ...options,
      }),
    info: (message, options = {}) =>
      reactToastifyToast.info(message, {
        position: 'top-center',
        autoClose: 1500,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: false,
        theme: 'colored',
        transition: Slide,
        ...options,
      }),
    warning: (message, options = {}) =>
      reactToastifyToast.warning(message, {
        position: 'top-center',
        autoClose: 2000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: false,
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
        autoClose={1500}
        hideProgressBar={true}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss={false}
        draggable={false}
        pauseOnHover={false}
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
