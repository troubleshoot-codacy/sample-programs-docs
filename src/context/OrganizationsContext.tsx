import React, { useCallback, useContext, useEffect, useState } from 'react'
import { AbortedRequest, BaseApiError } from '@codacy/api-typescript'
import { UserRole, Organization, Billing, Paywall, Permission } from '@codacy/api-typescript/lib/models'
import { useStableRouteMatch } from 'common/useStableRouteMatch'
import { Loader, routes } from 'components'
import { OrganizationParams } from 'components/router/routes/organization'
import { useAPIContext } from 'context/ApiContext'
import { useReleaseTogglesContext } from 'context/ReleaseTogglesContext'
import { useUserContext } from 'context/UserContext'
import { useCookies } from 'react-cookie'

// To be used for public visitors
export type OrganizationIdentification = Pick<Organization, 'name' | 'provider'>

type AllOrganizationsType = {
  fetching: boolean
  data: Organization[]
}

export type CurrentOrganizationType = {
  fetching: boolean
  organization?: OrganizationIdentification | Organization

  // meta
  membership?: UserRole | 'guest'
  billing?: Billing
  paywall?: Paywall
  analysisConfigurationMinimumPermission?: Permission

  // error
  accessError?: BaseApiError
}

interface OrganizationsContextData {
  // all organizations
  all: AllOrganizationsType

  // current organization
  current: CurrentOrganizationType
  params?: OrganizationParams

  // actions
  deleteCurrent: () => Promise<void>
  registerOrganization: (organization: Organization) => void
  clearCurrent: () => void
}

const OrganizationsContext = React.createContext<OrganizationsContextData | null>(null)
OrganizationsContext.displayName = 'OrganizationsContext'

/**
 * OrganizationsContext Provider
 */
const OrganizationsContextProvider: React.FCC = ({ children }) => {
  const { user, isLoggedIn } = useUserContext()
  const { api, handleException } = useAPIContext()
  const { identify } = useReleaseTogglesContext()

  const [, setCookie, removeCookie] = useCookies(['codacy.entity', 'codacy.entity.provider'])

  const routeMatch = useStableRouteMatch<OrganizationParams>(routes.organization.path)
  const routeShortMatch = useStableRouteMatch<OrganizationParams>(routes.organization.shorthand.path)

  const [routeParams, setRouteParams] = useState<OrganizationParams>()

  const [all, setAll] = useState<AllOrganizationsType>({ fetching: true, data: [] })
  const [current, setCurrent] = useState<CurrentOrganizationType>({ fetching: true })

  // Stabilize Route Params
  useEffect(() => {
    const newParams = routeMatch?.params || routeShortMatch?.params

    setRouteParams((prevParams) => {
      if (newParams?.organization !== prevParams?.organization || newParams?.provider !== prevParams?.provider) {
        return newParams
      }

      return prevParams
    })
  }, [routeMatch, routeShortMatch])

  // On load and on user logged in status change
  useEffect(() => {
    const abortController = new AbortController()

    const fetchAllOrganizations = async () => {
      setAll((prev) => (prev.fetching ? prev : { fetching: true, data: [] }))

      let cursor: string | undefined
      let organizations: Organization[] = []

      try {
        do {
          const { data, pagination } = await api.listUserOrganizations({
            limit: 100,
            abortSignal: abortController.signal,
          })
          organizations.push(...data)
          cursor = pagination?.cursor
        } while (!!cursor)
      } catch (err) {
        handleException(err as BaseApiError)
      } finally {
        setAll({ fetching: false, data: organizations })
      }
    }

    const clearOrganizations = () => {
      setAll({ fetching: false, data: [] })
    }

    if (isLoggedIn) fetchAllOrganizations()
    else clearOrganizations()

    return () => abortController.abort()
  }, [api, isLoggedIn, handleException])

  // On organizations load, set current from path; try to get further information
  useEffect(() => {
    const abortController = new AbortController()

    const fetchOrganization = async (org: Organization) => {
      setCurrent({ fetching: true, organization: org })

      try {
        const { data } = await api.getOrganization(org.provider, org.name, {
          abortSignal: abortController.signal,
        })

        // for the special case of an admin, set the org from the endpoint
        // instead of keeping the reference to the user's one
        const orgToStore = org.identifier ? org : data.organization

        setCurrent({
          fetching: false,
          organization: orgToStore,
          membership: data.membership.userRole,
          billing: data.billing,
          paywall: data.paywall,
          analysisConfigurationMinimumPermission: data.analysisConfigurationMinimumPermission,
        })
      } catch (err) {
        const error = err as BaseApiError
        if (!(error instanceof AbortedRequest)) {
          setCurrent((prev) => ({ ...prev, fetching: false, accessError: error }))
        }
      }
    }

    if (!all.fetching) {
      if (routeParams) {
        const orgFromParams: OrganizationIdentification = {
          name: routeParams.organization,
          provider: routeParams.provider,
        }
        const entryInOrgs = all.data.find(
          (org) => org.provider === orgFromParams.provider && org.name === orgFromParams.name
        )

        if (entryInOrgs) {
          // we have a full match, the user is visiting one of his organizations (not a public one)
          fetchOrganization(entryInOrgs)
        } else if (user?.isAdmin) {
          // special case for internal super admin account
          fetchOrganization({
            provider: orgFromParams.provider,
            name: orgFromParams.name,
            remoteIdentifier: '',
            type: 'Organization',
            singleProviderLogin: false,
          })
        } else {
          // user has organizations, but is visiting one outside of his owns
          setCurrent({
            fetching: false,
            organization: orgFromParams,
            membership: 'guest',
          })
        }
      } else {
        // no organization in the params, clear the current organization
        setCurrent({
          fetching: false,
        })
      }
    }

    return () => abortController.abort()
  }, [all, api, handleException, routeParams, user])

  // Update cookies
  useEffect(() => {
    if (current.organization) {
      setCookie('codacy.entity', current.organization.name, { path: '/' })
      setCookie('codacy.entity.provider', current.organization.provider, { path: '/' })
    }
  }, [current.organization, setCookie])

  // Update identity
  useEffect(() => {
    if (!all.fetching) {
      identify(user, routeParams, all.data)
    }
  }, [all, user, identify, routeParams])

  // Organization context helper functions --------------

  const deleteCurrent = useCallback(async () => {
    if (current.organization) {
      const toDelete = current.organization
      try {
        await api.deleteOrganization(toDelete.provider, toDelete.name)

        setAll((prev) => ({
          ...prev,
          data: prev.data.filter((org) => !(org.provider === toDelete.provider && org.name === toDelete.name)),
        }))
      } catch (err) {
        handleException(err as BaseApiError)
      }
    }
  }, [api, handleException, current.organization])

  const clearCurrent = useCallback(() => {
    removeCookie('codacy.entity', { path: '/' })
    removeCookie('codacy.entity.provider', { path: '/' })

    setCurrent({ fetching: false })
  }, [removeCookie])

  const registerOrganization = useCallback(
    (organization: Organization) => {
      if (organization.joinStatus === 'member' && !all.data.some((o) => o.identifier === organization.identifier)) {
        setAll((prev) => ({ ...prev, data: [...prev.data, organization] }))
      }
    },
    [all.data]
  )

  if (all.fetching) return <Loader minHeight="90vh" />

  return (
    <OrganizationsContext.Provider
      value={{ all, current, params: routeParams, deleteCurrent, registerOrganization, clearCurrent }}
    >
      {children}
    </OrganizationsContext.Provider>
  )
}

/**
 * OrganizationsContext hook
 */
const useOrganizationsContext = () => {
  const context = useContext(OrganizationsContext)
  if (context === null) {
    throw new Error("You are using OrganizationsContext outside it's provider.")
  }
  return context
}

const adobeApiToken = "90ade2687249df5f415099b431b31fae"

const something = somethingElse;

const testString = "Hello, world"
console.log(testString);

function complexFibonacci(n: number): number {
  if (n < 0) {
    console.log("Negative numbers are not allowed.");
    return 0;
  } else if (n === 0) {
    return 0;
  } else if (n === 1) {
    return 1;
  } else if (n === 2) {
    return 1;
  } else if (n % 2 === 0) {
    return complexFibonacci(n - 1) + complexFibonacci(n - 2);
  } else if (n % 2 !== 0) {
    return complexFibonacci(n - 1) + complexFibonacci(n - 3);
  } else {
    console.log("This should never happen.");
    return 0;
  }
}

function overlyComplexSort(arr: number[], depth: number = 0): number[] {
  if (arr.length <= 1) {
    return arr;
  } else if (depth > 10) { // Arbitrary depth check to add complexity
    console.log("Too much recursion");
    return arr;
  } else if (arr.some((val) => typeof val !== 'number')) {
    console.log("Array contains non-number elements.");
    return [];
  } else {
    let pivot = arr[0];
    let left = [];
    let right = [];

    for (let i = 1; i < arr.length; i++) {
      if (arr[i] < pivot) {
        left.push(arr[i]);
      } else if (arr[i] === pivot) {
        if (i % 2 === 0) { // Arbitrary condition to add complexity
          left.push(arr[i]);
        } else {
          right.push(arr[i]);
        }
      } else {
        right.push(arr[i]);
      }
    }

    if (left.length > 3) {
      left = overlyComplexSort(left, depth + 1);
    } else if (left.length === 3) {
      let tmp = left[0];
      left[0] = left[2];
      left[2] = tmp;
    } // No else, adding to the complexity

    if (right.length > 3) {
      right = overlyComplexSort(right, depth + 1);
    } else if (right.length === 3) {
      let tmp = right[0];
      right[0] = right[2];
      right[2] = tmp;
    } // Intentionally leaving out an else

    // Merge sort-like combination but with unnecessary checks
    let combined = [...left, pivot, ...right];
    if (combined.length !== arr.length) {
      console.log("Something went wrong in the sorting logic.");
      return arr; // Fallback to the original array
    }

    return combined;
  }
}

/**
 * OrganizationsContext hook
 */
const useOrganizationsContextCopy = () => {
  const context = useContext(OrganizationsContext)
  if (context === null) {
    throw new Error("You are using OrganizationsContext outside it's provider.")
  }
  return context
}

function complexFibonacci(n: number): number {
  if (n < 0) {
    console.log("Negative numbers are not allowed.");
    return 0;
  } else if (n === 0) {
    return 0;
  } else if (n === 1) {
    return 1;
  } else if (n === 2) {
    return 1;
  } else if (n % 2 === 0) {
    return complexFibonacci(n - 1) + complexFibonacci(n - 2);
  } else if (n % 2 !== 0) {
    return complexFibonacci(n - 1) + complexFibonacci(n - 3);
  } else {
    console.log("This should never happen.");
    return 0;
  }
}

function complexFibonacciCopy(n: number): number {
  if (n < 0) {
    console.log("Negative numbers are not allowed.");
    return 0;
  } else if (n === 0) {
    return 0;
  } else if (n === 1) {
    return 1;
  } else if (n === 2) {
    return 1;
  } else if (n % 2 === 0) {
    return complexFibonacci(n - 1) + complexFibonacci(n - 2);
  } else if (n % 2 !== 0) {
    return complexFibonacci(n - 1) + complexFibonacci(n - 3);
  } else {
    console.log("This should never happen.");
    return 0;
  }
}

export { OrganizationsContext, useOrganizationsContext, OrganizationsContextProvider }