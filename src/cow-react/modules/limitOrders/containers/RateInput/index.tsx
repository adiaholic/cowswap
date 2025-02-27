import * as styledEl from './styled'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'react-feather'
import { useAtomValue, useUpdateAtom } from 'jotai/utils'

import { HeadingText } from '@cow/modules/limitOrders/pure/RateInput/HeadingText'
import { limitRateAtom, updateLimitRateAtom } from '@cow/modules/limitOrders/state/limitRateAtom'
import { useLimitOrdersTradeState } from '@cow/modules/limitOrders/hooks/useLimitOrdersTradeState'
import { toFraction } from '@cow/modules/limitOrders/utils/toFraction'
import { useRateImpact } from '@cow/modules/limitOrders/hooks/useRateImpact'
import { isFractionFalsy } from '@cow/utils/isFractionFalsy'
import { getQuoteCurrency, getQuoteCurrencyByStableCoin } from '@cow/common/services/getQuoteCurrency'
import { useWeb3React } from '@web3-react/core'
import { getAddress } from '@cow/utils/getAddress'
import { useUpdateActiveRate } from '@cow/modules/limitOrders/hooks/useUpdateActiveRate'
import { TokenSymbol } from '@cow/common/pure/TokenSymbol'
import { formatInputAmount } from '@cow/utils/amountFormat'

export function RateInput() {
  const { chainId } = useWeb3React()
  // Rate state
  const {
    isInversed,
    activeRate,
    isLoading,
    executionRate,
    isLoadingExecutionRate,
    typedValue,
    isTypedValue,
    initialRate,
  } = useAtomValue(limitRateAtom)
  const updateRate = useUpdateActiveRate()
  const updateLimitRateState = useUpdateAtom(updateLimitRateAtom)
  const [isQuoteCurrencySet, setIsQuoteCurrencySet] = useState(false)

  // Limit order state
  const { inputCurrency, outputCurrency, inputCurrencyAmount, outputCurrencyAmount } = useLimitOrdersTradeState()
  const rateImpact = useRateImpact()
  const areBothCurrencies = !!inputCurrency && !!outputCurrency
  const inputCurrencyId = inputCurrency?.symbol
  const outputCurrencyId = outputCurrency?.symbol

  const primaryCurrency = isInversed ? outputCurrency : inputCurrency
  const secondaryCurrency = isInversed ? inputCurrency : outputCurrency

  // Handle rate display
  const displayedRate = useMemo(() => {
    if (isTypedValue) return typedValue || ''

    if (!activeRate || !areBothCurrencies || activeRate.equalTo(0)) return ''

    const rate = isInversed ? activeRate.invert() : activeRate

    return formatInputAmount(rate)
  }, [activeRate, areBothCurrencies, isInversed, isTypedValue, typedValue])

  // Handle set market price
  const handleSetMarketPrice = useCallback(() => {
    updateRate({
      activeRate: isFractionFalsy(executionRate) ? initialRate : executionRate,
      isTypedValue: false,
      isRateFromUrl: false,
    })
  }, [executionRate, initialRate, updateRate])

  // Handle rate input
  const handleUserInput = useCallback(
    (typedValue: string) => {
      updateLimitRateState({ typedValue })
      updateRate({
        activeRate: toFraction(typedValue, isInversed),
        isTypedValue: true,
        isRateFromUrl: false,
      })
    },
    [isInversed, updateRate, updateLimitRateState]
  )

  // Handle toggle primary field
  const handleToggle = useCallback(() => {
    updateLimitRateState({ isInversed: !isInversed, isTypedValue: false })
  }, [isInversed, updateLimitRateState])

  const isDisabledMPrice = useMemo(() => {
    if (isLoadingExecutionRate) return true

    if (!outputCurrencyId || !inputCurrencyId) return true

    if (executionRate && !executionRate.equalTo(0)) {
      return activeRate?.equalTo(executionRate)
    } else {
      return !!initialRate && activeRate?.equalTo(initialRate)
    }
  }, [activeRate, executionRate, isLoadingExecutionRate, initialRate, inputCurrencyId, outputCurrencyId])

  // Apply smart quote selection
  // use getQuoteCurrencyByStableCoin() first for cases when there are no amounts
  useEffect(() => {
    // Don't set quote currency until amounts are not set
    if (
      isQuoteCurrencySet ||
      isFractionFalsy(inputCurrencyAmount) ||
      isFractionFalsy(outputCurrencyAmount) ||
      !inputCurrency ||
      !outputCurrency
    ) {
      return
    }

    const quoteCurrency =
      getQuoteCurrencyByStableCoin(chainId, inputCurrency, outputCurrency) ||
      getQuoteCurrency(chainId, inputCurrencyAmount, outputCurrencyAmount)
    const [quoteCurrencyAddress, inputCurrencyAddress] = [getAddress(quoteCurrency), getAddress(inputCurrency)]

    updateLimitRateState({ isInversed: quoteCurrencyAddress !== inputCurrencyAddress })
    setIsQuoteCurrencySet(true)
  }, [
    isQuoteCurrencySet,
    chainId,
    inputCurrency,
    outputCurrency,
    inputCurrencyAmount,
    outputCurrencyAmount,
    updateLimitRateState,
  ])

  // Reset isQuoteCurrencySet flag on currencies changes
  useEffect(() => {
    setIsQuoteCurrencySet(false)
  }, [inputCurrency, outputCurrency])

  return (
    <styledEl.Wrapper>
      <styledEl.Header>
        <HeadingText inputCurrency={inputCurrency} currency={primaryCurrency} rateImpact={rateImpact} />

        <styledEl.MarketPriceButton disabled={isDisabledMPrice} onClick={handleSetMarketPrice}>
          <span>Market price</span>
        </styledEl.MarketPriceButton>
      </styledEl.Header>

      <styledEl.Body>
        {isLoading && areBothCurrencies ? (
          <styledEl.RateLoader />
        ) : (
          <styledEl.NumericalInput
            $loading={false}
            id="rate-limit-amount-input"
            value={displayedRate}
            onUserInput={handleUserInput}
          />
        )}

        <styledEl.ActiveCurrency onClick={handleToggle}>
          <styledEl.ActiveSymbol>
            <TokenSymbol token={secondaryCurrency} />
          </styledEl.ActiveSymbol>
          <styledEl.ActiveIcon>
            <RefreshCw size={12} />
          </styledEl.ActiveIcon>
        </styledEl.ActiveCurrency>
      </styledEl.Body>
    </styledEl.Wrapper>
  )
}
