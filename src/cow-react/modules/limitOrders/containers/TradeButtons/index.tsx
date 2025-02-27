import React, { useCallback } from 'react'
import { Trans } from '@lingui/macro'
import { useAtomValue } from 'jotai/utils'
import { useSetAtom } from 'jotai'
import { PriceImpactDeclineError, tradeFlow, TradeFlowContext } from '@cow/modules/limitOrders/services/tradeFlow'
import { limitOrdersSettingsAtom } from '@cow/modules/limitOrders/state/limitOrdersSettingsAtom'
import { useLimitOrdersTradeState } from '@cow/modules/limitOrders/hooks/useLimitOrdersTradeState'
import { useLimitOrdersFormState } from '../../hooks/useLimitOrdersFormState'
import { limitOrdersTradeButtonsMap, SwapButton, WrapUnwrapParams } from './limitOrdersTradeButtonsMap'
import { limitOrdersConfirmState } from '../LimitOrdersConfirmModal/state'
import { useCloseModals, useModalIsOpen, useToggleWalletModal } from 'state/application/hooks'
import { limitOrdersQuoteAtom } from '@cow/modules/limitOrders/state/limitOrdersQuoteAtom'
import { useLimitOrdersWarningsAccepted } from '@cow/modules/limitOrders/hooks/useLimitOrdersWarningsAccepted'
import { PriceImpact } from 'hooks/usePriceImpact'
import { useWrapCallback } from 'hooks/useWrapCallback'
import { Currency, CurrencyAmount } from '@uniswap/sdk-core'
import { transactionConfirmAtom } from '@cow/modules/swap/state/transactionConfirmAtom'
import { ApplicationModal } from '@src/state/application/reducer'
import { useErrorModal } from 'hooks/useErrorMessageAndModal'
import OperatorError from '@cow/api/gnosisProtocol/errors/OperatorError'
import { CompatibilityIssuesWarning } from '@cow/modules/trade/pure/CompatibilityIssuesWarning'
import { useWalletInfo } from 'hooks/useWalletInfo'
import styled from 'styled-components/macro'
import { isUnsupportedTokenInQuote } from '@cow/modules/limitOrders/utils/isUnsupportedTokenInQuote'

const CompatibilityIssuesWarningWrapper = styled.div`
  margin-top: -10px;
`

export interface TradeButtonsProps {
  tradeContext: TradeFlowContext | null
  priceImpact: PriceImpact
  inputCurrencyAmount: CurrencyAmount<Currency> | null
  openConfirmScreen(): void
}

export function TradeButtons(props: TradeButtonsProps) {
  const { tradeContext, openConfirmScreen, priceImpact, inputCurrencyAmount } = props
  const settingsState = useAtomValue(limitOrdersSettingsAtom)
  const formState = useLimitOrdersFormState()
  const tradeState = useLimitOrdersTradeState()
  const setConfirmationState = useSetAtom(limitOrdersConfirmState)
  const toggleWalletModal = useToggleWalletModal()
  const quote = useAtomValue(limitOrdersQuoteAtom)
  const warningsAccepted = useLimitOrdersWarningsAccepted(false)
  const wrapUnwrapCallback = useWrapCallback(inputCurrencyAmount)
  const transactionConfirmState = useAtomValue(transactionConfirmAtom)
  const closeModals = useCloseModals()
  const showTransactionConfirmationModal = useModalIsOpen(ApplicationModal.TRANSACTION_CONFIRMATION)
  const { handleSetError, ErrorModal } = useErrorModal()
  const { isSupportedWallet } = useWalletInfo()
  const { inputCurrency, outputCurrency } = tradeState
  const isSwapUnsupported = isUnsupportedTokenInQuote(quote)

  const wrapUnwrapParams: WrapUnwrapParams = {
    isNativeIn: !!inputCurrencyAmount?.currency.isNative,
    wrapUnwrapCallback,
    transactionConfirmState,
    closeModals,
    showTransactionConfirmationModal,
  }

  const doTrade = useCallback(() => {
    if (settingsState.expertMode && tradeContext) {
      const beforeTrade = () => setConfirmationState({ isPending: true, orderHash: null })

      tradeFlow(tradeContext, priceImpact, settingsState, beforeTrade)
        .catch((error) => {
          if (error instanceof PriceImpactDeclineError) return

          if (error instanceof OperatorError) {
            handleSetError(error.message)
          }
        })
        .finally(() => {
          setConfirmationState({ isPending: false, orderHash: null })
        })
    } else {
      openConfirmScreen()
    }
  }, [handleSetError, settingsState, tradeContext, openConfirmScreen, setConfirmationState, priceImpact])

  const buttonFactory = limitOrdersTradeButtonsMap[formState]

  const isButtonDisabled = (typeof buttonFactory !== 'function' && buttonFactory.disabled) || !warningsAccepted
  const showWarnings = !!(inputCurrency && outputCurrency && isSwapUnsupported)

  const Button =
    typeof buttonFactory === 'function' ? (
      buttonFactory({ tradeState, toggleWalletModal, quote, wrapUnwrapParams })
    ) : (
      <SwapButton id={buttonFactory.id} onClick={doTrade} disabled={isButtonDisabled}>
        <Trans>{buttonFactory.text}</Trans>
      </SwapButton>
    )

  return (
    <>
      {Button}
      {showWarnings && (
        <CompatibilityIssuesWarningWrapper>
          <CompatibilityIssuesWarning
            currencyIn={inputCurrency}
            currencyOut={outputCurrency}
            isSupportedWallet={isSupportedWallet}
          />
        </CompatibilityIssuesWarningWrapper>
      )}
      <ErrorModal />
    </>
  )
}
