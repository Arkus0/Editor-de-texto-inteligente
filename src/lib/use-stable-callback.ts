"use client"

import * as React from "react"

/**
 * Devuelve un controlador cuya identidad nunca cambia pero que siempre ejecuta
 * la última versión de la función recibida.
 *
 * Sirve para poder envolver un componente pesado en `React.memo` sin tener que
 * repartir `useCallback` con listas de dependencias por medio componente: con
 * `useCallback` cualquier dependencia olvidada produce un controlador que lee
 * estado caducado, un fallo silencioso y difícil de encontrar. Aquí el cuerpo
 * se reemplaza en cada render, así que lee siempre el estado actual.
 *
 * La referencia se actualiza en `useInsertionEffect`, que corre antes que los
 * efectos de diseño y que cualquier evento del navegador posterior al commit.
 *
 * Solo vale para controladores de eventos: no debe llamarse durante el render,
 * porque hasta que el commit termina sigue apuntando a la versión anterior.
 */
export function useStableCallback<Args extends unknown[], Result>(
  callback: (...args: Args) => Result
): (...args: Args) => Result {
  const latest = React.useRef(callback)

  React.useInsertionEffect(() => {
    latest.current = callback
  })

  return React.useCallback((...args: Args) => latest.current(...args), [])
}
