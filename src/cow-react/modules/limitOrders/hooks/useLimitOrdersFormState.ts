import { useWeb3React } from '@web3-react/core'
import { useTokenAllowance } from 'hooks/useTokenAllowance'
import { LimitOrdersTradeState, useLimitOrdersTradeState } from './useLimitOrdersTradeState'
import { useSafeMemo } from '@cow/common/hooks/useSafeMemo'
import { GP_VAULT_RELAYER } from 'constants/index'
import { ApprovalState } from 'hooks/useApproveCallback'
import { useTradeApproveState } from '@cow/common/containers/TradeApprove/useTradeApproveState'
import { useGnosisSafeInfo } from 'hooks/useGnosisSafeInfo'
import { useWalletInfo } from 'hooks/useWalletInfo'
import { Currency, CurrencyAmount, Fraction, Token } from '@uniswap/sdk-core'
import useENSAddress from 'hooks/useENSAddress'
import { isAddress } from 'utils'
import { useAtomValue } from 'jotai/utils'
import { limitOrdersQuoteAtom, LimitOrdersQuoteState } from '@cow/modules/limitOrders/state/limitOrdersQuoteAtom'
import { limitRateAtom } from '@cow/modules/limitOrders/state/limitRateAtom'
import { useDetectNativeToken } from '@cow/modules/swap/hooks/useDetectNativeToken'
import { isUnsupportedTokenInQuote } from '@cow/modules/limitOrders/utils/isUnsupportedTokenInQuote'

export enum LimitOrdersFormState {
  NotApproved = 'NotApproved',
  CanTrade = 'CanTrade',
  Loading = 'Loading',
  SwapIsUnsupported = 'SwapIsUnsupported',
  WrapUnwrap = 'WrapUnwrap',
  InvalidRecipient = 'InvalidRecipient',
  WalletIsUnsupported = 'WalletIsUnsupported',
  WalletIsNotConnected = 'WalletIsNotConnected',
  ReadonlyGnosisSafeUser = 'ReadonlyGnosisSafeUser',
  NeedToSelectToken = 'NeedToSelectToken',
  AmountIsNotSet = 'AmountIsNotSet',
  PriceIsNotSet = 'PriceIsNotSet',
  InsufficientBalance = 'InsufficientBalance',
  CantLoadBalances = 'CantLoadBalances',
  QuoteError = 'QuoteError',
  ZeroPrice = 'ZeroPrice',
}

interface LimitOrdersFormParams {
  account: string | undefined
  isSwapUnsupported: boolean
  isSupportedWallet: boolean
  isReadonlyGnosisSafeUser: boolean
  currentAllowance: CurrencyAmount<Token> | undefined
  approvalState: ApprovalState
  tradeState: LimitOrdersTradeState
  recipientEnsAddress: string | null
  quote: LimitOrdersQuoteState | null
  activeRate: Fraction | null
  isWrapOrUnwrap: boolean
  isRateLoading: boolean
  buyAmount: CurrencyAmount<Currency> | null
  sellAmount: CurrencyAmount<Currency> | null
}

function getLimitOrdersFormState(params: LimitOrdersFormParams): LimitOrdersFormState {
  const {
    account,
    isReadonlyGnosisSafeUser,
    isSupportedWallet,
    currentAllowance,
    approvalState,
    tradeState,
    recipientEnsAddress,
    quote,
    isWrapOrUnwrap,
    activeRate,
    isRateLoading,
    sellAmount,
    buyAmount,
    isSwapUnsupported,
  } = params

  const { inputCurrency, outputCurrency, inputCurrencyAmount, outputCurrencyAmount, inputCurrencyBalance, recipient } =
    tradeState

  const inputAmountIsNotSet = !inputCurrencyAmount || inputCurrencyAmount.equalTo(0)
  const outputAmountIsNotSet = !outputCurrencyAmount || outputCurrencyAmount.equalTo(0)

  if (quote?.error) {
    return LimitOrdersFormState.QuoteError
  }

  if (isSwapUnsupported) {
    return LimitOrdersFormState.SwapIsUnsupported
  }

  if (!account) {
    return LimitOrdersFormState.WalletIsNotConnected
  }

  if (!inputCurrency || !outputCurrency) {
    return LimitOrdersFormState.NeedToSelectToken
  }

  if (isWrapOrUnwrap) {
    if (inputAmountIsNotSet && outputAmountIsNotSet) {
      return LimitOrdersFormState.AmountIsNotSet
    }
  } else {
    if (inputAmountIsNotSet || outputAmountIsNotSet) {
      if (!activeRate || activeRate.equalTo(0)) {
        return LimitOrdersFormState.PriceIsNotSet
      }

      return LimitOrdersFormState.AmountIsNotSet
    }
  }

  if (recipient !== null && !recipientEnsAddress && !isAddress(recipient)) {
    return LimitOrdersFormState.InvalidRecipient
  }

  if (!isSupportedWallet) {
    return LimitOrdersFormState.WalletIsUnsupported
  }

  if (isReadonlyGnosisSafeUser) {
    return LimitOrdersFormState.ReadonlyGnosisSafeUser
  }

  if (!inputCurrencyBalance) {
    return LimitOrdersFormState.CantLoadBalances
  }

  if (inputCurrencyAmount && inputCurrencyBalance.lessThan(inputCurrencyAmount)) {
    return LimitOrdersFormState.InsufficientBalance
  }

  if (!isWrapOrUnwrap && (isRateLoading || !currentAllowance || !quote)) {
    return LimitOrdersFormState.Loading
  }

  if (isWrapOrUnwrap) {
    return LimitOrdersFormState.WrapUnwrap
  }

  if (approvalState === ApprovalState.NOT_APPROVED || approvalState === ApprovalState.PENDING) {
    return LimitOrdersFormState.NotApproved
  }

  if (
    (!sellAmount?.equalTo(0) && buyAmount?.toExact() === '0') ||
    (!buyAmount?.equalTo(0) && buyAmount?.toExact() === '0')
  ) {
    return LimitOrdersFormState.ZeroPrice
  }

  return LimitOrdersFormState.CanTrade
}

export function useLimitOrdersFormState(): LimitOrdersFormState {
  const { chainId, account } = useWeb3React()
  const tradeState = useLimitOrdersTradeState()
  const { isSupportedWallet } = useWalletInfo()
  const isReadonlyGnosisSafeUser = useGnosisSafeInfo()?.isReadOnly || false
  const quote = useAtomValue(limitOrdersQuoteAtom)
  const { activeRate, isLoading } = useAtomValue(limitRateAtom)
  const { isWrapOrUnwrap } = useDetectNativeToken()

  const { inputCurrency, recipient } = tradeState
  const sellAmount = tradeState.inputCurrencyAmount
  const buyAmount = tradeState.outputCurrencyAmount
  const sellToken = inputCurrency?.isToken ? inputCurrency : undefined
  const spender = chainId ? GP_VAULT_RELAYER[chainId] : undefined

  const currentAllowance = useTokenAllowance(sellToken, account ?? undefined, spender)
  const approvalState = useTradeApproveState(sellAmount)
  const isSwapUnsupported = isUnsupportedTokenInQuote(quote)
  const { address: recipientEnsAddress } = useENSAddress(recipient)

  const params: LimitOrdersFormParams = {
    account,
    isReadonlyGnosisSafeUser,
    isSwapUnsupported,
    isSupportedWallet,
    approvalState,
    currentAllowance,
    tradeState,
    recipientEnsAddress,
    quote,
    activeRate,
    isWrapOrUnwrap,
    isRateLoading: isLoading,
    buyAmount,
    sellAmount,
  }

  return useSafeMemo(() => {
    return getLimitOrdersFormState(params)
  }, Object.values(params))
}
